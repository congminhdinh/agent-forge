import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentService } from './agent/agent.service';
import { AgentRun } from './agent/agent-run.entity';
import { NotificationRecord } from './notifications/notification.entity';
import { User } from './users/user.entity';
import { Project } from './workspace/project.entity';
import { TaskItem } from './workspace/task.entity';
import { UpdateAdminUserDto } from './admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly agentService: AgentService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(TaskItem)
    private readonly tasksRepository: Repository<TaskItem>,
    @InjectRepository(AgentRun)
    private readonly runsRepository: Repository<AgentRun>,
    @InjectRepository(NotificationRecord)
    private readonly notificationsRepository: Repository<NotificationRecord>,
  ) {}

  async listUsers() {
    const users = await this.usersRepository.find({
      relations: {
        projects: {
          tasks: { runs: true },
        },
        notifications: true,
      },
      order: { createdAt: 'ASC' },
    });

    const weekStart = this.startOfUtcWeek();
    return users.map((user) => {
      const tasks = user.projects.flatMap((project) => project.tasks ?? []);
      const runs = tasks.flatMap((task) => task.runs ?? []);
      const weeklyRuns = runs.filter(
        (run) => new Date(run.createdAt).getTime() >= weekStart.getTime(),
      );

      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        authProvider: user.authProvider,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        maxConcurrentSessions: user.maxConcurrentSessions,
        maxWeeklyTasks: user.maxWeeklyTasks,
        isAdmin: user.isAdmin,
        onboardingCompleted: user.onboardingCompleted,
        projectCount: user.projects.length,
        activeTasks: tasks.filter((task) => task.status === 'in_progress').length,
        blockedTasks: tasks.filter((task) => task.status === 'blocked').length,
        deadLetterTasks: tasks.filter((task) => task.recoveryState === 'dead_letter')
          .length,
        weeklyCostUsd: this.roundCurrency(
          weeklyRuns.reduce((sum, run) => sum + (run.costUsd ?? 0), 0),
        ),
        weeklyTokens: weeklyRuns.reduce(
          (sum, run) => sum + (run.totalTokens ?? 0),
          0,
        ),
        unreadNotifications: (user.notifications ?? []).filter(
          (notification) => !notification.readAt && notification.channel === 'in_app',
        ).length,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    });
  }

  async updateUser(userId: string, body: UpdateAdminUserDto) {
    const user = await this.usersRepository.findOneByOrFail({ id: userId });
    if (body.subscriptionTier !== undefined) {
      user.subscriptionTier = body.subscriptionTier;
    }
    if (body.subscriptionStatus !== undefined) {
      user.subscriptionStatus = body.subscriptionStatus;
    }
    if (body.maxConcurrentSessions !== undefined) {
      user.maxConcurrentSessions = body.maxConcurrentSessions;
    }
    if (body.maxWeeklyTasks !== undefined) {
      user.maxWeeklyTasks = body.maxWeeklyTasks;
    }
    if (body.isAdmin !== undefined) {
      user.isAdmin = body.isAdmin;
    }

    await this.usersRepository.save(user);
    return this.listUsers();
  }

  async getSystemStats() {
    const [users, projects, tasks, runs, notifications, queue] = await Promise.all([
      this.usersRepository.count(),
      this.projectsRepository.count(),
      this.tasksRepository.find({
        relations: { project: true },
        order: { updatedAt: 'DESC' },
      }),
      this.runsRepository.find({
        relations: { task: true, role: true },
        order: { createdAt: 'DESC' },
        take: 25,
      }),
      this.notificationsRepository.find({
        relations: { user: true },
        order: { createdAt: 'DESC' },
        take: 20,
      }),
      this.agentService.getQueueStats(),
    ]);

    const weekStart = this.startOfUtcWeek();
    const weeklyRuns = runs.filter(
      (run) => new Date(run.createdAt).getTime() >= weekStart.getTime(),
    );
    const countsByStatus = tasks.reduce<Record<string, number>>((acc, task) => {
      acc[task.status] = (acc[task.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      users,
      projects,
      tasks: tasks.length,
      notifications: notifications.length,
      tasksByStatus: countsByStatus,
      weeklyCostUsd: this.roundCurrency(
        weeklyRuns.reduce((sum, run) => sum + (run.costUsd ?? 0), 0),
      ),
      weeklyTokens: weeklyRuns.reduce(
        (sum, run) => sum + (run.totalTokens ?? 0),
        0,
      ),
      queue,
      deadLetters: tasks
        .filter((task) => task.recoveryState === 'dead_letter')
        .slice(0, 8)
        .map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          projectId: task.project?.id ?? null,
          recoveryState: task.recoveryState,
          lastFailureReason: task.lastFailureReason,
          deadLetteredAt: task.deadLetteredAt,
          updatedAt: task.updatedAt,
        })),
      recentFailures: runs
        .filter((run) => run.status === 'failed' || run.error)
        .slice(0, 8)
        .map((run) => ({
          id: run.id,
          taskId: run.task?.id ?? null,
          taskTitle: run.task?.title ?? 'Unknown task',
          role: run.role?.displayName ?? run.role?.slug ?? 'Unknown role',
          error: run.error,
          createdAt: run.createdAt,
        })),
      recentNotifications: notifications.map((notification) => ({
        id: notification.id,
        kind: notification.kind,
        channel: notification.channel,
        status: notification.status,
        userEmail: notification.user?.email ?? null,
        title: notification.title,
        createdAt: notification.createdAt,
      })),
    };
  }

  private roundCurrency(value: number) {
    return Math.round(value * 10000) / 10000;
  }

  private startOfUtcWeek(input = new Date()) {
    const date = new Date(
      Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()),
    );
    const weekday = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - weekday);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }
}
