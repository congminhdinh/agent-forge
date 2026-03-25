import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentModule } from './agent/agent.module';
import { AgentRun } from './agent/agent-run.entity';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { AuthModule } from './auth/auth.module';
import { NotificationRecord } from './notifications/notification.entity';
import { User } from './users/user.entity';
import { Project } from './workspace/project.entity';
import { TaskItem } from './workspace/task.entity';

@Module({
  imports: [
    AuthModule,
    AgentModule,
    TypeOrmModule.forFeature([User, Project, TaskItem, AgentRun, NotificationRecord]),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
