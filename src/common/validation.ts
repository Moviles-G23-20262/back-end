import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength, registerDecorator, type ValidationOptions } from 'class-validator';

// Shared input rules. They sit on the DTOs of what a student types (sign-up, listings, chat), so the
// same rules apply whether the request comes from the app or from anything else.

/** Prices are Colombian pesos. The upper bound also keeps the value inside `Decimal(10, 2)`. */
export const MIN_PRICE_COP = 1_000;
export const MAX_PRICE_COP = 50_000_000;

/** Whole pesos or pesos with up to two decimals, as the `Decimal(10, 2)` columns store them. */
const AMOUNT = /^\d{1,8}(\.\d{1,2})?$/;

const trimString = (value: unknown) => (typeof value === 'string' ? value.trim() : value);

/** Removes the whitespace around a text. */
export const Trim = () => Transform(({ value }: { value: unknown }) => trimString(value));

/** Removes the whitespace around a text and turns every run of whitespace inside it into one space. */
export const CollapseSpaces = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  );

// Control characters and the invisible ones (zero-width space, bidi marks, BOM). Line breaks and tabs
// are fine in a long text; a zero-width joiner is fine too because emoji sequences use it.
const INVISIBLE = '\\p{Cc}\\u200B\\u200E\\u200F\\u202A-\\u202E\\u2060-\\u2064\\uFEFF';
export const NO_CONTROL_CHARS = new RegExp(`^(?:[^${INVISIBLE}]|[\\n\\r\\t])*$`, 'u');

export const NoControlChars = () =>
  Matches(NO_CONTROL_CHARS, { message: '$property must not contain control or invisible characters' });

/** Letters (with accents and combining marks), single spaces, "." and "-". */
export const PERSON_NAME = /^[\p{L}\p{M} .-]+$/u;
export const AT_LEAST_TWO_LETTERS = /^(?:[^\p{L}]*\p{L}){2}/u;
export const NO_EMOJI = /^(?!.*\p{Extended_Pictographic})/su;

/**
 * The password chosen at sign-up or reset: printable ASCII without spaces (one character is one
 * byte, which is what bcrypt reads), 8 to 72 characters, with an uppercase letter, a lowercase
 * letter, a digit and a symbol. Login does not use it: older accounts have simpler passwords.
 */
export const StrongPassword = () =>
  applyDecorators(
    IsString(),
    MinLength(8),
    MaxLength(72),
    Matches(/^[\x21-\x7E]+$/, {
      message: 'password must only use letters, numbers and symbols, without spaces or accents',
    }),
    Matches(/[A-Z]/, { message: 'password must contain an uppercase letter' }),
    Matches(/[a-z]/, { message: 'password must contain a lowercase letter' }),
    Matches(/[0-9]/, { message: 'password must contain a number' }),
    Matches(/[^A-Za-z0-9]/, { message: 'password must contain a symbol' }),
  );

/** A listing price: between [MIN_PRICE_COP] and [MAX_PRICE_COP] pesos, sent as text. */
export function IsCopPrice(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isCopPrice',
      target: object.constructor,
      propertyName,
      options: {
        message: `price must be between ${MIN_PRICE_COP} and ${MAX_PRICE_COP} COP`,
        ...validationOptions,
      },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && AMOUNT.test(value) && Number(value) >= MIN_PRICE_COP && Number(value) <= MAX_PRICE_COP,
      },
    });
}

/** An amount of money above zero that fits in `Decimal(10, 2)`. */
export function IsPositiveAmount(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isPositiveAmount',
      target: object.constructor,
      propertyName,
      options: { message: '$property must be greater than 0 and have at most 8 digits', ...validationOptions },
      validator: {
        validate: (value: unknown) => typeof value === 'string' && AMOUNT.test(value) && Number(value) > 0,
      },
    });
}
