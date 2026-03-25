import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AgentService } from '../agent/agent.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../users/user.entity';
import { CreateTaskDto, SubmitReviewDto, UpdateTaskDto } from './workspace.dto';
import { WorkspaceService } from './workspace.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class TasksController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly agentService: AgentService,
  ) {}

  @Get('projects/:projectId/tasks')
  listTasks(@CurrentUser() user: User, @Param('projectId') projectId: string) {
    return this.workspaceService.listTasks(user, projectId);
  }

  @Post('projects/:projectId/tasks')
  createTask(
    @CurrentUser() user: User,
    @Param('projectId') projectId: string,
    @Body() body: CreateTaskDto,
  ) {
    return this.workspaceService.createTask(user, projectId, body);
  }

  @Get('tasks/:taskId')
  getTask(@CurrentUser() user: User, @Param('taskId') taskId: string) {
    return this.workspaceService.getTask(user, taskId);
  }

  @Patch('tasks/:taskId')
  updateTask(
    @CurrentUser() user: User,
    @Param('taskId') taskId: string,
    @Body() body: UpdateTaskDto,
  ) {
    return this.workspaceService.updateTask(user, taskId, body);
  }

  @Post('tasks/:taskId/dispatch')
  dispatchTask(@CurrentUser() user: User, @Param('taskId') taskId: string) {
    return this.agentService.dispatchTask(user, taskId);
  }

  @Get('tasks/:taskId/reviews')
  listReviews(@CurrentUser() user: User, @Param('taskId') taskId: string) {
    return this.agentService.listReviews(user, taskId);
  }

  @Post('tasks/:taskId/review')
  submitReview(
    @CurrentUser() user: User,
    @Param('taskId') taskId: string,
    @Body() body: SubmitReviewDto,
  ) {
    return this.agentService.submitReview(user, taskId, body);
  }
}