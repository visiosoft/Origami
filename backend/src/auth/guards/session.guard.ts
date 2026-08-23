import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import { IS_PUBLIC } from './public.decorator';
import { SESSION_COOKIE, readCookie } from './cookie.util';

/** Requests carry their resolved session so controllers don't re-parse the header. */
export type AuthedRequest = Request & { claims?: import('../crypto.util').SessionClaims };

/**
 * Requires a valid session on every route that isn't explicitly `@Public()`.
 *
 * Two credential sources are accepted:
 *
 *  - `Authorization: Bearer` — what the app's fetch wrapper sends.
 *  - the session cookie — for URLs the browser loads by itself, where no header
 *    can be attached: `<img src>` thumbnails and download links.
 *
 * The cookie is honoured for GET/HEAD only. A cross-site form can make the
 * browser send cookies but cannot set an Authorization header, so requiring the
 * header on every mutation removes CSRF as a category rather than mitigating it.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  private readonly log = new Logger('Auth');

  /**
   * Audit mode logs what it would have rejected and lets it through, so the
   * guard can be deployed and observed before it starts breaking things. There
   * is no test suite, so this is how missed routes get found.
   */
  private readonly audit = process.env.AUTH_AUDIT === '1';

  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const claims = await this.resolve(req);
    if (claims) {
      req.claims = claims;
      return true;
    }

    if (this.audit) {
      this.log.warn(`AUDIT would reject unauthenticated ${req.method} ${req.originalUrl}`);
      return true;
    }
    throw new UnauthorizedException('Sign in to continue.');
  }

  private async resolve(req: AuthedRequest) {
    const header = req.headers.authorization;
    if (header) return this.auth.verify(header);

    if (req.method === 'GET' || req.method === 'HEAD') {
      const cookie = readCookie(req.headers.cookie, SESSION_COOKIE);
      if (cookie) return this.auth.verify(cookie);
    }
    return null;
  }
}
