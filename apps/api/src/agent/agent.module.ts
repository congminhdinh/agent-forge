import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { SettingsModule } from '../settings/settings.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { RealtimeService } from '../realtime.service';
import { AgentRun } from './agent-run.entity';
import { AgentService } from './agent.service';

@Module({
  imports: [
    SettingsModule,
    TypeOrmModule.forFeature([AgentRun, User]),
    forwardRef(() => WorkspaceModule),
  ],
  providers: [AgentService, RealtimeService],
  exports: [AgentService, RealtimeService],
})
export class AgentModule {}