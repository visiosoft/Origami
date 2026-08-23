import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GoogleService } from './google.service';
import { SettingsService } from '../settings/settings.service';
import { AuthService } from '../auth/auth.service';
import { signState, readState } from '../auth/crypto.util';
import { BRAND_KEYS, brandingFrom, buildLetterHtml, safeFilename } from '../documents/letterhead';
import { Public } from '../auth/guards/public.decorator';
import { Roles } from '../auth/guards/roles.decorator';
import { SESSION_COOKIE, sessionCookieOptions } from '../auth/guards/cookie.util';

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
  @Roles('admin')
  @Get('connect')
  async connect(@Res() res: Response) {
    const secret = await this.settings.jwtSecret();
    const url = await this.google.consentUrl('connect', signState({ mode: 'connect' }, secret));
    return res.redirect(url);
  }

  /** Start "Sign in with Google" for an end user. */
  @Public()
  @Get('login')
  async login(@Res() res: Response) {
    const secret = await this.settings.jwtSecret();
    const url = await this.google.consentUrl('login', signState({ mode: 'login' }, secret));
    return res.redirect(url);
  }

  /** The single OAuth redirect URI — handles both flows via the signed state. */
  @Public()
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
      // Mirror the password flow: the cookie is what lets <img src> URLs work.
      res.cookie(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresIn));
      return res.redirect(`${base}/login#token=${encodeURIComponent(session.token)}`);
    } catch (err: any) {
      return fail(err?.response?.message || err?.message || 'Google sign-in failed.');
    }
  }

  @Roles('admin')
  @Post('disconnect')
  async disconnect() {
    await this.google.disconnect();
    return this.google.status();
  }

  /** Send a test message to confirm the Gmail connection works end to end. */
  @Roles('admin')
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

  /**
   * Render a letter on the company letterhead and return it as a PDF.
   *
   * Used for the preview in the composer, so what is downloaded here is byte
   * for byte what `send-letter` attaches.
   */
  @Post('letter/pdf')
  async letterPdf(
    @Body() body: { subject?: string; html?: string; recipient?: string; date?: string; filename?: string },
    @Res() res: Response,
  ) {
    const pdf = await this.renderLetter(body);
    const filename = safeFilename(body.filename || body.subject || 'Letter') + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.end(pdf);
  }

  /** Email a letter with the branded PDF attached. */
  @Post('send-letter')
  async sendLetter(@Body() body: {
    to: string; subject: string; html: string; cc?: string; bcc?: string;
    recipient?: string; date?: string; filename?: string;
  }) {
    const pdf = await this.renderLetter(body);
    const filename = safeFilename(body.filename || body.subject || 'Letter') + '.pdf';
    await this.google.sendMail({
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      html: body.html,
      attachments: [{ filename, mimeType: 'application/pdf', content: pdf }],
    });
    return { ok: true, filename };
  }

  /** Shared by the preview and the send, so neither can drift from the other. */
  private async renderLetter(body: { subject?: string; html?: string; recipient?: string; date?: string }) {
    const brand = brandingFrom(await this.settings.getMany(BRAND_KEYS));
    const html = buildLetterHtml({
      brand,
      title: body.subject,
      recipient: body.recipient,
      date: body.date,
      body: body.html || '',
    });
    return this.google.htmlToPdf(html, safeFilename(body.subject || 'Letter'));
  }

  /** Create a folder, upload, read back and trash — proves Drive access works. */
  @Roles('admin')
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
