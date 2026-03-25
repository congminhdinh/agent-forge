import { Controller, Get, UseGuards } from '@nestjs/common';
import { AgentService } from './agent/agent.service';
import { CurrentUser } from './auth/current-user.decorator';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { User } from './users/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class UsageController {
  constructor(private readonly agentService: AgentService) {}

  @Get('me')
  getSubscription(@CurrentUser() user: User) {
    return this.agentService.getSubscriptionSummary(user);
  }

  @Get('me/usage')
  getUsage(@CurrentUser() user: User) {
    return this.agentService.getUsageSummary(user);
  }
}