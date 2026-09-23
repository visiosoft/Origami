import { Controller, Delete, Get, Headers, Post } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { ManpowerAccess } from './manpower-access.service';
import { SampleDataService } from './sample-data.service';

@Tiers('internal')
@Controller('manpower/sample-data')
export class SampleDataController {
  constructor(private readonly service: SampleDataService, private readonly access: ManpowerAccess) {}

  @Get() status() { return this.service.status(); }
  @Post() async load(@Headers('authorization') a?: string) { return this.service.load(await this.access.actor(a)); }
  @Post('payroll') async payroll(@Headers('authorization') a?: string) { return this.service.loadPayroll(await this.access.actor(a)); }
  @Delete() async remove(@Headers('authorization') a?: string) { return this.service.remove(await this.access.actor(a)); }
}
