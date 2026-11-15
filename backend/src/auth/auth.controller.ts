import { Body, Controller, Get, Headers, Param, Post, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, SetPasswordDto, ForgotPasswordDto, NotificationPrefsDto } from './dto/auth.dto';
import { Public } from './guards/public.decorator';
import { AnySignedIn } from './guards/roles.decorator';
import { DEVICE_COOKIE, deviceCookieOptions, readCookie, SESSION_COOKIE, sessionCookieOptions } from './guards/cookie.util';
import { Roles } from './guards/roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.login(dto.email, dto.password, readCookie(req.headers.cookie, DEVICE_COOKIE));
    // Staff go on to the second step (Nov 13): no session yet, just a ticket.
    if (!('token' in session)) return session;
    // The same token, also as a cookie: the browser attaches it to <img src>
    // and download URLs, which cannot carry an Authorization header.
    res.cookie(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresIn));
    return session;
  }

  // ---------------------------------------------------------- two-step sign-in (Nov 13)
  private signedIn(res: Response, s: { token: string; expiresIn: number; deviceToken?: string | null }) {
    res.cookie(SESSION_COOKIE, s.token, sessionCookieOptions(s.expiresIn));
    if (s.deviceToken) res.cookie(DEVICE_COOKIE, s.deviceToken, deviceCookieOptions());
    const { deviceToken, ...out } = s;
    void deviceToken;
    return out;
  }

  /** Setting up: a secret for the authenticator app. */
  @Public()
  @Post('2fa/setup')
  twoFactorSetup(@Body() body: { ticket: string }) {
    return this.auth.twoFactorSetup(body?.ticket);
  }

  /** The first code from the app: two-step sign-in is on, backup codes are shown once, signed in. */
  @Public()
  @Post('2fa/enable')
  async twoFactorEnable(@Body() body: { ticket: string; code: string; remember?: boolean; method?: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.signedIn(res, await this.auth.twoFactorEnable(body?.ticket, body?.code, String(req.headers['user-agent'] || ''), !!body?.remember, body?.method || 'app'));
  }

  /** What the second step looks like: set-up or code, which way, and where codes go. */
  @Public()
  @Post('2fa/info')
  twoFactorInfo(@Body() body: { ticket: string }) {
    return this.auth.twoFactorInfo(body?.ticket);
  }

  /** Text or email a sign-in code (Nov 13): to their number / email, or -- setting up -- to the one they picked. */
  @Public()
  @Post('2fa/send')
  twoFactorSend(@Body() body: { ticket: string; method?: string; phone?: string }) {
    return this.auth.twoFactorSend(body?.ticket, { method: body?.method, phone: body?.phone });
  }

  /** Signed in, text / email users: a code to confirm a change. */
  @AnySignedIn()
  @Post('2fa/code')
  sendOwnCode(@Headers('authorization') authorization?: string) {
    return this.auth.sendOwnCode(authorization);
  }

  /** Switch how codes come: set up the new way ... */
  @AnySignedIn()
  @Post('2fa/method')
  changeMethod(@Body() body: { method: string; phone?: string }, @Headers('authorization') authorization?: string) {
    return this.auth.changeMethodStart(authorization, String(body?.method || ''), body?.phone);
  }

  /** ... and its first code switches to it. */
  @AnySignedIn()
  @Post('2fa/method/confirm')
  confirmMethod(@Body() body: { method: string; code: string }, @Headers('authorization') authorization?: string) {
    return this.auth.changeMethodConfirm(authorization, String(body?.method || ''), String(body?.code || ''));
  }

  /** Signing in with a code from the app (or a backup code). */
  @Public()
  @Post('2fa/verify')
  async twoFactorVerify(@Body() body: { ticket: string; code?: string; backupCode?: string; remember?: boolean }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.signedIn(res, await this.auth.twoFactorVerify(body?.ticket, { code: body?.code, backupCode: body?.backupCode, remember: !!body?.remember, deviceLabel: String(req.headers['user-agent'] || '') }));
  }

  /** New backup codes for the signed-in user (needs a current code). */
  @AnySignedIn()
  @Post('2fa/backup-codes')
  newBackupCodes(@Body() body: { code: string }, @Headers('authorization') authorization?: string) {
    return this.auth.newBackupCodes(authorization, body?.code);
  }

  /** An administrator clears a user's two-step sign-in (lost phone). */
  @Roles('admin')
  @Post('2fa/reset/:userId')
  resetTwoFactor(@Param('userId') userId: string) {
    return this.auth.resetTwoFactor(userId);
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

  /** Renews the session (and its cookie) while the old one is still valid. */
  @AnySignedIn()
  @Post('refresh')
  async refresh(@Headers('authorization') authorization: string | undefined, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.refresh(authorization);
    res.cookie(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresIn));
    return session;
  }

  @AnySignedIn()
  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    return this.auth.me(authorization);
  }

  /** The caller's own notification preferences. */
  @Put('me/notifications')
  setNotificationPrefs(@Body() dto: NotificationPrefsDto, @Headers('authorization') authorization?: string) {
    return this.auth.setNotificationPrefs(authorization, dto);
  }
}
