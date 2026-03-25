import {
  Controller,
  MessageEvent,
  Param,
  Query,
  Sse,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { WorkspaceService } from './workspace/workspace.service';
import { RealtimeService } from './realtime.service';

@Controller('events')
export class RealtimeController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly workspaceService: WorkspaceService,
    private readonly realtimeService: RealtimeService,
  ) {}

  @Sse('projects/:projectId')
  async streamProject(
    @Param('projectId') projectId: string,
    @Query('token') token?: string,
  ): Promise<Observable<MessageEvent>> {
    const userId = await this.requireUserId(token);
    await this.workspaceService.findProject(userId, projectId);
    return this.realtimeService.streamProject(projectId);
  }

  @Sse('tasks/:taskId')
  async streamTask(
    @Param('taskId') taskId: string,
    @Query('token') token?: string,
  ): Promise<Observable<MessageEvent>> {
    const userId = await this.requireUserId(token);
    await this.workspaceService.findTask(userId, taskId);
    return this.realtimeService.streamTask(taskId);
  }

  @Sse('usage')
  async streamUsage(
    @Query('token') token?: string,
  ): Promise<Observable<MessageEvent>> {
    const userId = await this.requireUserId(token);
    return this.realtimeService.streamUsage(userId);
  }

  @Sse('notifications')
  async streamNotifications(
    @Query('token') token?: string,
  ): Promise<Observable<MessageEvent>> {
    const userId = await this.requireUserId(token);
    return this.realtimeService.streamNotifications(userId);
  }

  private async requireUserId(token?: string) {
    if (!token) {
      throw new UnauthorizedException('A session token is required for realtime streams.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
      return payload.sub;
    } catch {
      throw new UnauthorizedException('The realtime stream token is invalid or expired.');
    }
  }
}
