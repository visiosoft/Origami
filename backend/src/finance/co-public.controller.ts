import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/guards/public.decorator';
import { ChangeOrdersService } from './change-orders.service';

/** /api/change-order-view?token=… -- the PDF a client's "View the change order" link opens (Oct 27 backlog item 12). */
@Controller('change-order-view')
export class ChangeOrderPublicController {
  constructor(private readonly cos: ChangeOrdersService) {}

  @Public()
  @Get()
  async view(@Query('token') token: string, @Res() res: Response) {
    try {
      const { pdf, filename } = await this.cos.publicPdf(token);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename.replace(/"/g, '')}"`);
      return res.end(pdf);
    } catch (e) {
      return res.status(403).type('text/plain').send((e as Error).message || 'This link is no longer valid.');
    }
  }
}
