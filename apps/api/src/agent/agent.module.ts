import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime.module';
import { User } from '../users/user.entity';
import { SettingsModule } from '../settings/settings.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AgentRun } from './agent-run.entity';
import { AgentService } from './agent.service';

@Module({
  imports: [
    RealtimeModule,
    SettingsModule,
    NotificationsModule,
    TypeOrmModule.forFeature([AgentRun, User]),
    forwardRef(() => WorkspaceModule),
  ],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
