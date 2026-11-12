import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ResetPasswordDto } from '../auth/dto/email-code.dto';
import { CreateExchangeDto } from '../exchanges/dto/create-exchange.dto';
import { CreateMaterialDto } from '../materials/dto/create-material.dto';
import { CreateMessageDto } from '../messages/dto/create-message.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';

// The same options the app's ValidationPipe uses (main.ts): transform first, then validate.
async function problems<T extends object>(type: new () => T, body: Record<string, unknown>) {
  const instance = plainToInstance(type, body);
  const errors = await validate(instance, { whitelist: true });
  return { instance, fields: errors.map((error) => error.property), errors };
}

const uuid = '11111111-1111-4111-8111-111111111111';

describe('CreateUserDto', () => {
  const valid = {
    email: 'ana@uniandes.edu.co',
    password: 'CampusSwap1!',
    fullName: 'Ana Gómez',
    major: 'Systems Engineering',
  };

  it('accepts what the app sends', async () => {
    expect((await problems(CreateUserDto, valid)).fields).toEqual([]);
    expect((await problems(CreateUserDto, { ...valid, faculty: 'Faculty of Engineering' })).fields).toEqual([]);
  });

  it('cleans the text before validating it', async () => {
    const { instance, fields } = await problems(CreateUserDto, {
      ...valid,
      email: '  ANA.Gomez@Uniandes.edu.co ',
      fullName: '  Ana    María   Gómez ',
      major: '  Systems   Engineering ',
      faculty: '  Faculty   of   Law ',
    });

    expect(fields).toEqual([]);
    expect(instance.email).toBe('ana.gomez@uniandes.edu.co');
    expect(instance.fullName).toBe('Ana María Gómez');
    expect(instance.major).toBe('Systems Engineering');
    expect(instance.faculty).toBe('Faculty of Law');
  });

  it.each(['ana@gmail.com', 'ana@uniandes.edu.co.evil.com', 'ana@uni.edu', '.ana@uniandes.edu.co', 'ana..g@uniandes.edu.co'])(
    'refuses the email %s',
    async (email) => {
      expect((await problems(CreateUserDto, { ...valid, email })).fields).toContain('email');
    },
  );

  it('refuses an email of more than 254 characters', async () => {
    const email = `${'a'.repeat(250)}@uniandes.edu.co`;
    expect((await problems(CreateUserDto, { ...valid, email })).fields).toContain('email');
  });

  it.each([
    ['only spaces', '        '],
    ['a space inside', 'Campus Swap1!'],
    ['an emoji', 'CampusSwap1!😀'],
    ['an accent', 'Campusñwap1!'],
    ['no uppercase letter', 'campusswap1!'],
    ['no lowercase letter', 'CAMPUSSWAP1!'],
    ['no number', 'CampusSwap!!'],
    ['no symbol', 'CampusSwap11'],
    ['7 characters', 'Aa1!aaa'],
    ['73 characters', `Aa1!${'a'.repeat(69)}`],
  ])('refuses a password with %s', async (_name, password) => {
    expect((await problems(CreateUserDto, { ...valid, password })).fields).toContain('password');
  });

  it('accepts a password of exactly 72 characters', async () => {
    expect((await problems(CreateUserDto, { ...valid, password: `Aa1!${'a'.repeat(68)}` })).fields).toEqual([]);
  });

  it.each([
    ['an emoji', 'Ana 😀'],
    ['only digits', '1234'],
    ['symbols', 'Ana <b>'],
    ['one letter', 'A'],
    ['only punctuation', '..'],
    ['81 characters', 'a'.repeat(81)],
    ['only spaces', '    '],
  ])('refuses a full name with %s', async (_name, fullName) => {
    expect((await problems(CreateUserDto, { ...valid, fullName })).fields).toContain('fullName');
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['an emoji', 'ISIS 🎓'],
    ['one letter', 'A'],
    ['only digits', '1234'],
    ['81 characters', 'a'.repeat(81)],
    ['a control character', 'IS\u0007IS'],
  ])('refuses a major that is %s', async (_name, major) => {
    expect((await problems(CreateUserDto, { ...valid, major })).fields).toContain('major');
  });

  it('a profile update goes through the same rules, only for what it changes', async () => {
    expect((await problems(UpdateUserDto, { fullName: 'Ana Gómez' })).fields).toEqual([]);
    expect((await problems(UpdateUserDto, { fullName: 'Ana 😀' })).fields).toContain('fullName');
    expect((await problems(UpdateUserDto, { fullName: '   ' })).fields).toContain('fullName');
    expect((await problems(UpdateUserDto, { password: 'weakpass' })).fields).toContain('password');
    expect((await problems(UpdateUserDto, { email: 'ana@gmail.com' })).fields).toContain('email');
  });
});

describe('ResetPasswordDto', () => {
  const valid = { email: 'ana@uniandes.edu.co', code: '123456', newPassword: 'CampusSwap1!' };

  it('accepts a strong password', async () => {
    expect((await problems(ResetPasswordDto, valid)).fields).toEqual([]);
  });

  it.each(['12345678', 'correct-horse', 'Campus Swap1!', 'CampusSwap1!😀'])('refuses the password %s', async (newPassword) => {
    expect((await problems(ResetPasswordDto, { ...valid, newPassword })).fields).toContain('newPassword');
  });
});

describe('CreateMaterialDto', () => {
  const valid = {
    title: 'Arduino UNO',
    description: 'Barely used, with its cable',
    price: '45000.00',
    condition: 'GOOD',
    category: 'LAB_EQUIPMENT',
    imageUrls: ['https://blob.test/a.jpg'],
  };

  it('accepts what the app sends', async () => {
    expect((await problems(CreateMaterialDto, valid)).fields).toEqual([]);
    expect((await problems(CreateMaterialDto, { ...valid, price: '45000' })).fields).toEqual([]);
  });

  it('trims the title and description', async () => {
    const { instance, fields } = await problems(CreateMaterialDto, {
      ...valid,
      title: '  Arduino    UNO ',
      description: '  Barely used,\nwith its cable  ',
    });

    expect(fields).toEqual([]);
    expect(instance.title).toBe('Arduino UNO');
    expect(instance.description).toBe('Barely used,\nwith its cable');
  });

  it.each(['0', '0.00', '999', '999.99', '50000000.01', '100000000', '99999999999999999999', '-5000', '45.000,5', 'abc', ''])(
    'refuses the price %s',
    async (price) => {
      expect((await problems(CreateMaterialDto, { ...valid, price })).fields).toContain('price');
    },
  );

  it.each(['1000', '1000.00', '50000000', '50000000.00'])('accepts the price %s', async (price) => {
    expect((await problems(CreateMaterialDto, { ...valid, price })).fields).toEqual([]);
  });

  it.each([
    ['empty', ''],
    ['only spaces', '     '],
    ['2 characters', 'ab'],
    ['101 characters', 'a'.repeat(101)],
    ['a control character', 'Arduino\u0000UNO'],
    ['an invisible character', 'Arduino\u200BUNO'],
  ])('refuses a title that is %s', async (_name, title) => {
    expect((await problems(CreateMaterialDto, { ...valid, title })).fields).toContain('title');
  });

  it('accepts a title with an emoji, which is not a control character', async () => {
    expect((await problems(CreateMaterialDto, { ...valid, title: 'Arduino UNO 🔧' })).fields).toEqual([]);
  });

  it.each([
    ['empty', ''],
    ['only spaces', '          '],
    ['9 characters', 'a'.repeat(9)],
    ['1001 characters', 'a'.repeat(1001)],
    ['a control character', 'Barely used\u0007 with cable'],
  ])('refuses a description that is %s', async (_name, description) => {
    expect((await problems(CreateMaterialDto, { ...valid, description })).fields).toContain('description');
  });

  it('needs between 1 and 3 photos, each one a URL', async () => {
    const urls = (n: number) => Array.from({ length: n }, (_, i) => `https://blob.test/${i}.jpg`);
    expect((await problems(CreateMaterialDto, { ...valid, imageUrls: [] })).fields).toContain('imageUrls');
    expect((await problems(CreateMaterialDto, { ...valid, imageUrls: urls(3) })).fields).toEqual([]);
    expect((await problems(CreateMaterialDto, { ...valid, imageUrls: urls(4) })).fields).toContain('imageUrls');
    expect((await problems(CreateMaterialDto, { ...valid, imageUrls: ['not a url'] })).fields).toContain('imageUrls');
    expect((await problems(CreateMaterialDto, { ...valid, imageUrls: ['ftp://x.test/a.jpg'] })).fields).toContain('imageUrls');
    expect((await problems(CreateMaterialDto, { ...valid, imageUrls: ['http://localhost:3000/a.jpg'] })).fields).toEqual([]);
  });

  it('needs a condition and a category from the enums', async () => {
    const withoutCondition = Object.fromEntries(Object.entries(valid).filter(([key]) => key !== 'condition'));
    expect((await problems(CreateMaterialDto, withoutCondition)).fields).toContain('condition');
    expect((await problems(CreateMaterialDto, { ...valid, condition: 'BROKEN' })).fields).toContain('condition');
    expect((await problems(CreateMaterialDto, { ...valid, category: 'CARS' })).fields).toContain('category');
  });
});

describe('CreateMessageDto', () => {
  it('trims the message and refuses one that is only whitespace', async () => {
    const ok = await problems(CreateMessageDto, { chatRoomId: uuid, content: '  hello  ' });
    expect(ok.fields).toEqual([]);
    expect(ok.instance.content).toBe('hello');

    for (const content of ['', '   ', '\n\t  ']) {
      expect((await problems(CreateMessageDto, { chatRoomId: uuid, content })).fields).toContain('content');
    }
  });

  it('refuses a message of more than 2000 characters', async () => {
    expect((await problems(CreateMessageDto, { chatRoomId: uuid, content: 'a'.repeat(2001) })).fields).toContain('content');
    expect((await problems(CreateMessageDto, { chatRoomId: uuid, content: 'a'.repeat(2000) })).fields).toEqual([]);
  });
});

describe('CreateExchangeDto', () => {
  const valid = { materialId: uuid, buyerId: uuid, sellerId: uuid, price: '25000.00' };

  it('needs a price above zero that fits the column', async () => {
    expect((await problems(CreateExchangeDto, valid)).fields).toEqual([]);
    for (const price of ['0', '0.00', '-1', '100000000', 'abc']) {
      expect((await problems(CreateExchangeDto, { ...valid, price })).fields).toContain('price');
    }
  });
});
