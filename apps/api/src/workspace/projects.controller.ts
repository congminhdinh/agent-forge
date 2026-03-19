import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../users/user.entity';
import { CreateProjectDto, UpdateProjectDto } from './workspace.dto';
import { WorkspaceService } from './workspace.service';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  listProjects(@CurrentUser() user: User) {
    return this.workspaceService.listProjects(user);
  }

  @Get(':projectId')
  getProject(@CurrentUser() user: User, @Param('projectId') projectId: string) {
    return this.workspaceService.getProject(user, projectId);
  }

  @Post()
  createProject(@CurrentUser() user: User, @Body() body: CreateProjectDto) {
    return this.workspaceService.createProject(user, body);
  }

  @Patch(':projectId')
  updateProject(
    @CurrentUser() user: User,
    @Param('projectId') projectId: string,
    @Body() body: UpdateProjectDto,
  ) {
    return this.workspaceService.updateProject(user, projectId, body);
  }

  @Delete(':projectId')
  deleteProject(@CurrentUser() user: User, @Param('projectId') projectId: string) {
    return this.workspaceService.deleteProject(user, projectId);
  }
}
