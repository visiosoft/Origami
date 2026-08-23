import { Controller, Get } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { DashboardService } from './dashboard.service';

@Tiers('internal')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  getKpis() {
    return this.dashboardService.getKpis();
  }

  @Get('budget-vs-spend')
  getBudgetVsSpend() {
    return this.dashboardService.getBudgetVsSpend();
  }

  @Get('revenue-by-month')
  getRevenueByMonth() {
    return this.dashboardService.getRevenueByMonth();
  }

  @Get('lead-funnel')
  getLeadFunnel() {
    return this.dashboardService.getLeadFunnel();
  }

  @Get('workload')
  getWorkload() {
    return this.dashboardService.getWorkload();
  }
}
