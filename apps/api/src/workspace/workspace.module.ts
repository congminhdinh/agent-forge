import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentModule } from '../agent/agent.module';
import { AuthModule } from '../auth/auth.module';
import { Project } from './project.entity';
import { ProjectsController } from './projects.controller';
import { AgentRole } from './role.entity';
import { RolesController } from './roles.controller';
import { TaskItem } from './task.entity';
import { TasksController } from './tasks.controller';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Project, AgentRole, TaskItem]),
    forwardRef(() => AgentModule),
  ],
  controllers: [ProjectsController, RolesController, TasksController],
  providers: [WorkspaceService],
  exports: [WorkspaceService, TypeOrmModule],
})
export class WorkspaceModule {}
