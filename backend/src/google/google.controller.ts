import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GoogleService } from './google.service';
import { SettingsService } from '../settings/settings.service';
import { AuthService } from '../auth/auth.service';
import { signState, readState } from '../auth/crypto.util';

@Controller('google')
export class GoogleController {
  constructor(
    private readonly google: GoogleService,
    private readonly settings: SettingsService,
    private readonly auth: AuthService,
  ) {}

  /** Whether Google is configured, and which account is currently connected. */
  @Get('status')
  status() {
    return this.google.status();
  }

  /** Start the admin flow that connects the workspace account (Gmail + Drive). */
  @Get('connect')
  async connect(@Res() res: Response) {
    const secret = await this.settings.jwtSecret();
    const url = await this.google.consentUrl('connect', signState({ mode: 'connect' }, secret));
    return res.redirect(url);
  }

  /** Start "Sign in with Google" for an end user. */
  @Get('login')
  async login(@Res() res: Response) {
    const secret = await this.settings.jwtSecret();
    const url = await this.google.consentUrl('login', signState({ mode: 'login' }, secret));
    return res.redirect(url);
  }

  /** The single OAuth redirect URI — handles both flows via the signed state. */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const base = (await this.settings.baseUrl()) || '';
    const secret = await this.settings.jwtSecret();
    const parsed = readState(state, secret);
    const mode = parsed?.mode === 'connect' ? 'connect' : 'login';
    const fail = (msg: string) =>
      res.redirect(
        mode === 'connect'
          ? `${base}/settings?tab=google&error=${encodeURIComponent(msg)}`
          : `${base}/login?error=${encodeURIComponent(msg)}`,
      );

    if (error) return fail(error === 'access_denied' ? 'Google sign-in was cancelled.' : error);
    if (!parsed) return fail('The sign-in link expired. Please try again.');
    if (!code) return fail('Google did not return an authorization code.');

    try {
      const tokens = await this.google.exchangeCode(code);
      const profile = await this.google.profile(tokens.access_token);

      if (mode === 'connect') {
        await this.google.saveConnection(tokens.refresh_token, profile);
        return res.redirect(`${base}/settings?tab=google&connected=${encodeURIComponent(profile.email)}`);
      }

      const session = await this.auth.loginWithGoogle(profile);
      // The token rides in the fragment so it never lands in server or proxy logs.
      return res.redirect(`${base}/login#token=${encodeURIComponent(session.token)}`);
    } catch (err: any) {
      return fail(err?.response?.message || err?.message || 'Google sign-in failed.');
    }
  }

  @Post('disconnect')
  async disconnect() {
    await this.google.disconnect();
    return this.google.status();
  }

  /** Send a test message to confirm the Gmail connection works end to end. */
  @Post('test-email')
  async test(@Body() body: { to?: string }) {
    const to = body?.to || (await this.settings.get('google.connectedEmail')) || '';
    if (!to) return { sent: false, error: 'No recipient. Connect a Google account first.' };
    await this.google.sendMail({
      to,
      subject: 'Origami test email',
      html: '<p>Your Origami workspace is connected to Gmail — outgoing mail is working.</p>',
    });
    return { sent: true, to };
  }

  /** Send an email as the connected workspace account (intro letters, etc.). */
  @Post('send')
  send(@Body() body: { to: string; subject: string; html: string; cc?: string; bcc?: string }) {
    return this.google.sendMail(body);
  }

  /** Create a folder, upload, read back and trash — proves Drive access works. */
  @Post('drive/test')
  testDrive() {
    return this.google.testDrive();
  }

  /** Recent Drive files from the connected account. */
  @Get('drive/files')
  files(@Query('q') q?: string) {
    return this.google.listDriveFiles(q);
  }
}
