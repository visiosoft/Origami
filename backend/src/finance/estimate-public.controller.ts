import { Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../auth/guards/public.decorator';
import { AnySignedIn } from '../auth/guards/roles.decorator';
import { Claims } from '../auth/guards/claims.decorator';
import type { SessionClaims } from '../auth/crypto.util';
import { ProjectAccessService } from '../auth/project-access.service';
import { EstimateLetterService } from './estimate-letter.service';

/**
 * /api/estimate-public -- the client's own page for an estimate (K8, Nov 13):
 * read it, download the PDF, accept it with a signature. No account needed;
 * the signed 60-day link is the key.
 */
@Controller('estimate-public')
export class EstimatePublicController {
  constructor(private readonly letters: EstimateLetterService, private readonly access: ProjectAccessService) {}

  /** A client's estimates, to review here (Nov 13): only on the projects they're linked to. */
  @AnySignedIn()
  @Get('mine')
  async mine(@Claims() claims: SessionClaims | null) {
    if (!claims || claims.tier !== 'client') return [];
    return this.letters.forClient(await this.access.allowedIds(claims));
  }

  @Public()
  @Get()
  view(@Query('token') token: string) { return this.letters.publicView(token); }

  @Public()
  @Get('pdf')
  async pdf(@Query('token') token: string, @Res() res: Response) {
    try {
      const { pdf, filename } = await this.letters.publicPdf(token);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename.replace(/"/g, '')}"`);
      return res.end(pdf);
    } catch (e) {
      return res.status(403).type('text/plain').send((e as Error).message || 'This link is no longer valid.');
    }
  }

  @Public()
  @Post('sign')
  sign(@Body() body: { token: string; name?: string; email?: string; image?: string; agree?: boolean }, @Req() req: Request) {
    return this.letters.sign(body?.token, body || {}, { ip: req.ip || '' });
  }
}
