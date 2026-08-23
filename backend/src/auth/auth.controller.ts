import { Body, Controller, Get, Headers, Param, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, SetPasswordDto, ForgotPasswordDto, NotificationPrefsDto } from './dto/auth.dto';
import { Public } from './guards/public.decorator';
import { SESSION_COOKIE, sessionCookieOptions } from './guards/cookie.util';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.login(dto.email, dto.password);
    // The same token, also as a cookie: the browser attaches it to <img src>
    // and download URLs, which cannot carry an Authorization header.
    res.cookie(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresIn));
    return session;
  }

  /** Ends the cookie session. The bearer token is discarded by the client. */
  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(0), maxAge: undefined });
    return { ok: true };
  }

  /** Details behind an invite / reset link, so the screen can greet the user. */
  @Public()
  @Get('invite/:token')
  invite(@Param('token') token: string) {
    return this.auth.readInvite(token);
  }

  @Public()
  @Post('set-password')
  setPassword(@Body() dto: SetPasswordDto) {
    return this.auth.setPassword(dto.token, dto.password);
  }

  @Public()
  @Post('forgot-password')
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    return this.auth.me(authorization);
  }

  /** The caller's own notification preferences. */
  @Put('me/notifications')
  setNotificationPrefs(@Body() dto: NotificationPrefsDto, @Headers('authorization') authorization?: string) {
    return this.auth.setNotificationPrefs(authorization, dto.notifyOnAssignment);
  }
}
