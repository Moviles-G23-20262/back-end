import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto } from './dto/email-code.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { requireUserId, type AuthContext } from './auth-context';
import { Auth, Public } from './auth.decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('me')
  me(@Auth() auth: AuthContext) {
    return this.authService.me(requireUserId(auth));
  }

  /** Always 204, whether or not the email has an account. */
  @Public()
  @Post('forgot-password')
  @HttpCode(204)
  forgotPassword(@Body() { email }: ForgotPasswordDto) {
    return this.authService.forgotPassword(email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  /** Sends a new code to the signed-in user (one is already sent on register). */
  @Post('verify-email/send')
  @HttpCode(204)
  sendVerificationEmail(@Auth() auth: AuthContext) {
    return this.authService.sendVerificationEmail(requireUserId(auth));
  }

  @Post('verify-email')
  @HttpCode(200)
  verifyEmail(@Auth() auth: AuthContext, @Body() { code }: VerifyEmailDto) {
    return this.authService.verifyEmail(requireUserId(auth), code);
  }
}
