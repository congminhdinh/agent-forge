import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsModule } from '../settings/settings.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AgentRun } from './agent-run.entity';
import { AgentService } from './agent.service';

@Module({
  imports: [
    SettingsModule,
    TypeOrmModule.forFeature([AgentRun]),
    forwardRef(() => WorkspaceModule),
  ],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
