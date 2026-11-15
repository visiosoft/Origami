import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../auth/guards/public.decorator';
import { SettingsService } from './settings.service';
import { BRAND_FALLBACK } from '../documents/letterhead';


/**
 * The workspace's own name, tagline, logo and colour for the app itself (Nov 10:
 * Settings -> Branding only reached documents and emails; the app and the sign-in
 * screen showed a fixed logo). Public: the sign-in screen needs it before login.
 * Only display fields -- nothing private.
 */
@Controller('brand')
export class BrandController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  async brand() {
    const s = await this.settings.getMany(['brand.companyName', 'brand.tagline', 'brand.logoDataUrl', 'brand.accentColor']);
    return {
      companyName: String(s['brand.companyName'] || '').trim() || BRAND_FALLBACK.companyName,
      tagline: String(s['brand.tagline'] || '').trim() || null,
      logoDataUrl: String(s['brand.logoDataUrl'] || '').startsWith('data:image/') ? s['brand.logoDataUrl'] : null,
      accentColor: /^#[0-9a-f]{3,8}$/i.test(String(s['brand.accentColor'] || '')) ? s['brand.accentColor'] : BRAND_FALLBACK.accentColor,
    };
  }
}
