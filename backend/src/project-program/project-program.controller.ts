import { Body, Controller, Get, Put, Query, Req } from '@nestjs/common';
import { ProjectProgramService } from './project-program.service';
import { Tiers } from '../auth/guards/roles.decorator';

@Tiers('internal')
@Controller('project-program')
export class ProjectProgramController {
  constructor(private readonly service: ProjectProgramService) {}

  @Get()
  get(@Query('projectId') projectId: string) {
    return this.service.get(Number(projectId));
  }

  @Put()
  save(@Body() body: { projectId: number; data: unknown }, @Req() req: any) {
    return this.service.save(Number(body?.projectId), body?.data, req?.user);
  }

  @Put('complete')
  complete(@Body() body: { projectId: number; complete?: boolean }) {
    return this.service.setComplete(Number(body?.projectId), body?.complete !== false);
  }
}
