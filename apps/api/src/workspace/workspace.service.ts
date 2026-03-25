import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AgentRun } from '../agent/agent-run.entity';
import { User } from '../users/user.entity';
import {
  BootstrapSampleProjectDto,
  CreateProjectDto,
  CreateRoleDto,
  CreateTaskDto,
  ImportRoleTemplatesDto,
  UpdateProjectDto,
  UpdateRoleDto,
  UpdateTaskDto,
} from './workspace.dto';
import { Project } from './project.entity';
import { AgentRole } from './role.entity';
import {
  serializeRun,
  serializeProject,
  serializeRole,
  serializeTask,
} from './workspace.serializer';
import { TaskItem } from './task.entity';
import {
  DEFAULT_ROLE_PRESETS,
  ROLE_TEMPLATE_LIBRARY,
  TASK_STATUS_TRANSITIONS,
  TASK_STATUSES,
  TaskMessageRecord,
  TaskReviewRecord,
  TaskTransitionRecord,
} from './workspace.types';

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(AgentRole)
    private readonly rolesRepository: Repository<AgentRole>,
    @InjectRepository(TaskItem)
    private readonly tasksRepository: Repository<TaskItem>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(AgentRun)
    private readonly runsRepository: Repository<AgentRun>,
  ) {}

  async listProjects(user: User) {
    const projects = await this.projectsRepository.find({
      where: { user: { id: user.id } },
      relations: {
        user: true,
        roles: { project: true },
        tasks: {
          project: true,
          assignedRole: { project: true },
          runs: { task: true, role: { project: true } },
        },
      },
      order: { updatedAt: 'DESC' },
    });

    await this.hydrateTaskRuns(projects.flatMap((project) => project.tasks ?? []));
    return projects.map(serializeProject);
  }

  async getProject(user: User, projectId: string) {
    const project = await this.findProject(user.id, projectId);
    return serializeProject(project);
  }

  async createProject(user: User, body: CreateProjectDto) {
    const project = await this.createProjectRecord(user, {
      name: body.name.trim(),
      description: body.description?.trim() ?? '',
      githubRepo: body.githubRepo?.trim() || null,
      githubBranchPrefix: body.githubBranchPrefix?.trim() || 'agentforge/',
    });

    return this.getProject(user, project.id);
  }

  async bootstrapSampleProject(user: User, body: BootstrapSampleProjectDto) {
    const project = await this.createProjectRecord(user, {
      name: body.name?.trim() || 'Starter Forge',
      description:
        body.description?.trim() ||
        'Phase 3 onboarding project with seeded tasks, role templates, and operational controls.',
      githubRepo: null,
      githubBranchPrefix: 'agentforge/',
    });

    const hydrated = await this.findProject(user.id, project.id);
    const roleBySlug = new Map(
      hydrated.roles.map((role) => [role.slug, role] as const),
    );

    const sampleTasks = [
      {
        title: 'Map the delivery workflow',
        description:
          'Use the architect role to outline the initial delivery, review, and operator workflow.',
        roleSlug: 'architect',
        priority: 0,
      },
      {
        title: 'Wire the admin controls',
        description:
          'Use the developer role to verify the admin, quota, and system stats surfaces.',
        roleSlug: 'developer',
        priority: 1,
      },
      {
        title: 'Check the notification path',
        description:
          'Use the tester role to validate review and failure notifications in the starter workspace.',
        roleSlug: 'tester',
        priority: 2,
      },
    ];

    const created = sampleTasks.map((task) =>
      this.tasksRepository.create({
        project: hydrated,
        title: task.title,
        description: task.description,
        priority: task.priority,
        assignedRole: roleBySlug.get(task.roleSlug) ?? null,
        modelOverride: null,
        status: 'backlog',
        latestSummary: null,
        reviewFeedback: null,
        reviewRequestedRoleSlug: null,
        githubBranch: null,
        githubPrNumber: null,
        githubPrUrl: null,
        githubStatus: null,
        githubStatusReason: null,
        retryCount: 0,
        maxRetries: 2,
        recoveryState: 'healthy',
        lastFailureReason: null,
        deadLetteredAt: null,
        messages: [],
        reviews: [],
        transitions: [],
        runHistory: [],
      }),
    );

    await this.tasksRepository.save(created);
    return this.getProject(user, project.id);
  }

  async updateProject(user: User, projectId: string, body: UpdateProjectDto) {
    const project = await this.findProject(user.id, projectId);
    if (body.name !== undefined) {
      project.name = body.name.trim();
    }
    if (body.description !== undefined) {
      project.description = body.description.trim();
    }
    if (body.githubRepo !== undefined) {
      project.githubRepo = body.githubRepo?.trim() || null;
    }
    if (body.githubBranchPrefix !== undefined) {
      project.githubBranchPrefix = body.githubBranchPrefix.trim();
    }

    await this.projectsRepository.save(project);
    return this.getProject(user, projectId);
  }

  async deleteProject(user: User, projectId: string) {
    const project = await this.findProject(user.id, projectId);
    await this.projectsRepository.remove(project);
    return { deleted: true, projectId };
  }

  async listRoles(user: User, projectId: string) {
    const project = await this.findProject(user.id, projectId);
    return project.roles
      .slice()
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
      .map(serializeRole);
  }

  listRoleTemplateLibrary() {
    return ROLE_TEMPLATE_LIBRARY;
  }

  async exportRoleTemplates(user: User, projectId: string) {
    const project = await this.findProject(user.id, projectId);
    return {
      projectId: project.id,
      projectName: project.name,
      exportedAt: new Date().toISOString(),
      roles: project.roles
        .slice()
        .sort((left, right) => left.displayName.localeCompare(right.displayName))
        .map((role) => {
          const template =
            ROLE_TEMPLATE_LIBRARY.find((entry) => entry.slug === role.slug) ?? null;
          return {
            slug: role.slug,
            displayName: role.displayName,
            systemPromptTemplate: role.systemPromptTemplate,
            modelPreference: role.modelPreference,
            toolAccessPolicy: role.toolAccessPolicy ?? [],
            summary: template?.summary ?? 'Project-exported role template.',
            category: template?.category ?? 'project',
          };
        }),
    };
  }

  async importRoleTemplates(
    user: User,
    projectId: string,
    body: ImportRoleTemplatesDto,
  ) {
    if (!Array.isArray(body.roles) || body.roles.length === 0) {
      throw new UnprocessableEntityException('Provide at least one role template.');
    }

    const project = await this.findProject(user.id, projectId);
    for (const template of body.roles) {
      const existing = project.roles.find((role) => role.slug === template.slug);
      if (existing && body.mode !== 'replace_existing') {
        continue;
      }

      if (existing) {
        existing.displayName = template.displayName.trim();
        existing.systemPromptTemplate = template.systemPromptTemplate;
        existing.modelPreference = template.modelPreference.trim();
        existing.toolAccessPolicy = template.toolAccessPolicy ?? [];
        await this.rolesRepository.save(existing);
        continue;
      }

      const created = this.rolesRepository.create({
        project,
        slug: template.slug.trim(),
        displayName: template.displayName.trim(),
        systemPromptTemplate: template.systemPromptTemplate,
        modelPreference: template.modelPreference.trim(),
        toolAccessPolicy: template.toolAccessPolicy ?? [],
      });
      await this.rolesRepository.save(created);
    }

    return this.getProject(user, projectId);
  }

  async createRole(user: User, projectId: string, body: CreateRoleDto) {
    const project = await this.findProject(user.id, projectId);
    const existing = project.roles.find((role) => role.slug === body.slug.trim());
    if (existing) {
      throw new UnprocessableEntityException(
        `Role slug "${body.slug}" already exists for this project.`,
      );
    }

    const role = this.rolesRepository.create({
      project,
      slug: body.slug.trim(),
      displayName: body.displayName.trim(),
      systemPromptTemplate: body.systemPromptTemplate,
      modelPreference: body.modelPreference.trim(),
      toolAccessPolicy: body.toolAccessPolicy ?? [],
    });

    await this.rolesRepository.save(role);
    return this.getProject(user, projectId);
  }

  async updateRole(user: User, roleId: string, body: UpdateRoleDto) {
    const role = await this.findRole(user.id, roleId);
    if (body.slug !== undefined) {
      role.slug = body.slug.trim();
    }
    if (body.displayName !== undefined) {
      role.displayName = body.displayName.trim();
    }
    if (body.systemPromptTemplate !== undefined) {
      role.systemPromptTemplate = body.systemPromptTemplate;
    }
    if (body.modelPreference !== undefined) {
      role.modelPreference = body.modelPreference.trim();
    }
    if (body.toolAccessPolicy !== undefined) {
      role.toolAccessPolicy = body.toolAccessPolicy;
    }

    await this.rolesRepository.save(role);
    return serializeRole(await this.findRole(user.id, roleId));
  }

  async deleteRole(user: User, roleId: string) {
    const role = await this.findRole(user.id, roleId);
    const tasksUsingRole = await this.tasksRepository.count({
      where: { assignedRole: { id: role.id } },
    });
    if (tasksUsingRole > 0) {
      throw new UnprocessableEntityException(
        'This role is still assigned to one or more tasks.',
      );
    }

    await this.rolesRepository.remove(role);
    return { deleted: true, roleId };
  }

  async listTasks(user: User, projectId: string) {
    const project = await this.findProject(user.id, projectId);
    return project.tasks.map(serializeTask);
  }

  async getTask(user: User, taskId: string) {
    const task = await this.findTask(user.id, taskId);
    return serializeTask(task);
  }

  async createTask(user: User, projectId: string, body: CreateTaskDto) {
    const project = await this.findProject(user.id, projectId);
    let assignedRole: AgentRole | null = null;
    if (body.assignedRoleId) {
      assignedRole =
        project.roles.find((role) => role.id === body.assignedRoleId) ?? null;
      if (!assignedRole) {
        throw new NotFoundException('Assigned role not found for this project.');
      }
    }

    const task = this.tasksRepository.create({
      project,
      title: body.title.trim(),
      description: body.description?.trim() ?? '',
      priority: body.priority ?? 2,
      assignedRole,
      modelOverride: body.modelOverride?.trim() ?? null,
      status: 'backlog',
      latestSummary: null,
      reviewFeedback: null,
      reviewRequestedRoleSlug: null,
      githubBranch: null,
      githubPrNumber: null,
      githubPrUrl: null,
      githubStatus: null,
      githubStatusReason: null,
      retryCount: 0,
      maxRetries: 2,
      recoveryState: 'healthy',
      lastFailureReason: null,
      deadLetteredAt: null,
      messages: [],
      reviews: [],
      transitions: [],
      runHistory: [],
    });

    const savedTask = await this.tasksRepository.save(task);
    return this.getTask(user, savedTask.id);
  }

  async updateTask(user: User, taskId: string, body: UpdateTaskDto) {
    const task = await this.findTask(user.id, taskId);
    if (body.title !== undefined) {
      task.title = body.title.trim();
    }
    if (body.description !== undefined) {
      task.description = body.description.trim();
    }
    if (body.priority !== undefined) {
      task.priority = body.priority;
    }
    if (body.modelOverride !== undefined) {
      task.modelOverride = body.modelOverride?.trim() || null;
    }
    if (body.status !== undefined) {
      if (!TASK_STATUSES.includes(body.status)) {
        throw new UnprocessableEntityException('Unsupported task status.');
      }
      await this.transitionTaskStatus(task, body.status, {
        triggeredBy: 'human',
        actorId: user.id,
        reason: 'Updated from the workspace task editor.',
      });
    }
    if (body.assignedRoleId !== undefined) {
      if (!body.assignedRoleId) {
        task.assignedRole = null;
      } else {
        const role = await this.findRole(user.id, body.assignedRoleId);
        if (role.project.id !== task.project.id) {
          throw new UnprocessableEntityException(
            'Assigned role must belong to the same project.',
          );
        }
        task.assignedRole = role;
      }
    }

    await this.tasksRepository.save(task);
    return this.getTask(user, taskId);
  }

  async findTask(userId: string, taskId: string) {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId, project: { user: { id: userId } } },
      relations: {
        project: { user: true, roles: { project: true } },
        assignedRole: { project: true },
        runs: { task: true, role: { project: true } },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    await this.hydrateTaskRuns([task]);
    task.messages = Array.isArray(task.messages) ? task.messages : [];
    task.reviews = Array.isArray(task.reviews) ? task.reviews : [];
    task.transitions = Array.isArray(task.transitions) ? task.transitions : [];
    task.runHistory = Array.isArray(task.runHistory) ? task.runHistory : [];
    return task;
  }

  async saveTask(task: TaskItem) {
    return this.tasksRepository.save(task);
  }

  async findProject(userId: string, projectId: string) {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId, user: { id: userId } },
      relations: {
        user: true,
        roles: { project: true },
        tasks: {
          project: true,
          assignedRole: { project: true },
          runs: { task: true, role: { project: true } },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    await this.hydrateTaskRuns(project.tasks);
    project.tasks.forEach((task) => {
      task.messages = Array.isArray(task.messages) ? task.messages : [];
      task.reviews = Array.isArray(task.reviews) ? task.reviews : [];
      task.transitions = Array.isArray(task.transitions) ? task.transitions : [];
      task.runHistory = Array.isArray(task.runHistory) ? task.runHistory : [];
    });

    return project;
  }

  async findRoleBySlug(userId: string, projectId: string, slug: string) {
    const role = await this.rolesRepository.findOne({
      where: {
        slug,
        project: {
          id: projectId,
          user: { id: userId },
        },
      },
      relations: { project: true },
    });

    if (!role) {
      throw new NotFoundException(`Role "${slug}" was not found for this project.`);
    }

    return role;
  }

  async transitionTaskStatus(
    task: TaskItem,
    toStatus: TaskItem['status'],
    options: {
      triggeredBy: 'agent' | 'human' | 'system';
      actorId: string;
      reason?: string | null;
    },
  ) {
    const fromStatus = task.status;
    if (fromStatus === toStatus) {
      return task;
    }

    const allowed =
      TASK_STATUS_TRANSITIONS[fromStatus as keyof typeof TASK_STATUS_TRANSITIONS];
    if (!allowed?.includes(toStatus as never)) {
      throw new UnprocessableEntityException(
        `Cannot move a task from "${fromStatus}" to "${toStatus}".`,
      );
    }

    task.status = toStatus;
    task.transitions = [
      ...(Array.isArray(task.transitions) ? task.transitions : []),
      {
        id: randomUUID(),
        fromStatus,
        toStatus,
        triggeredBy: options.triggeredBy,
        actorId: options.actorId,
        reason: options.reason ?? null,
        createdAt: new Date().toISOString(),
      } satisfies TaskTransitionRecord,
    ];

    return this.tasksRepository.save(task);
  }

  async appendTaskMessage(task: TaskItem, message: TaskMessageRecord) {
    task.messages = [...(Array.isArray(task.messages) ? task.messages : []), message];
    return this.tasksRepository.save(task);
  }

  async appendTaskReview(task: TaskItem, review: TaskReviewRecord) {
    task.reviews = [...(Array.isArray(task.reviews) ? task.reviews : []), review];
    return this.tasksRepository.save(task);
  }

  async getUsageFacts(userId: string) {
    const projects = await this.projectsRepository.find({
      where: { user: { id: userId } },
      relations: {
        user: true,
        roles: { project: true },
        tasks: {
          project: true,
          assignedRole: { project: true },
          runs: { task: true, role: { project: true } },
        },
      },
    });

    await this.hydrateTaskRuns(projects.flatMap((project) => project.tasks ?? []));
    const tasks = projects.flatMap((project) => project.tasks ?? []);
    const weekStart = this.startOfUtcWeek();
    const weeklyTasks = tasks.reduce((count, task) => {
      const transitions = Array.isArray(task.transitions) ? task.transitions : [];
      return (
        count +
        transitions.filter((transition) => {
          if (transition?.toStatus !== 'in_progress') {
            return false;
          }
          return new Date(transition.createdAt as string).getTime() >= weekStart.getTime();
        }).length
      );
    }, 0);

    const activeSessions = tasks.filter((task) => task.status === 'in_progress').length;
    const recentRuns = tasks
      .flatMap((task) => {
        const runs =
          task.runs && task.runs.length > 0
            ? task.runs.map((run) => serializeRun(run))
            : task.runHistory ?? [];
        return runs.map((run) => ({
          taskId: task.id,
          taskTitle: task.title,
          role:
            typeof run.role === 'object' && run.role
              ? String((run.role as { displayName?: string; slug?: string }).displayName ??
                  (run.role as { slug?: string }).slug ??
                  'Unknown')
              : 'Unknown',
          model: `${String(run.provider)}:${String(run.model)}`,
          status: run.status,
          summary: run.summary,
          durationSec:
            typeof run.durationMs === 'number' && run.durationMs > 0
              ? Math.max(1, Math.round(run.durationMs / 1000))
              : run.finishedAt
                ? Math.max(
                    1,
                    Math.round(
                      (new Date(String(run.finishedAt)).getTime() -
                        new Date(String(run.createdAt)).getTime()) /
                        1000,
                    ),
                  )
                : null,
          inputTokens: Number(run.inputTokens ?? 0),
          outputTokens: Number(run.outputTokens ?? 0),
          totalTokens: Number(run.totalTokens ?? 0),
          costUsd: Number(run.costUsd ?? 0),
          costSource: String(run.costSource ?? 'estimated'),
          createdAt: run.createdAt,
          finishedAt: run.finishedAt,
        }));
      })
      .sort(
        (left, right) =>
          new Date(String(right.createdAt)).getTime() -
          new Date(String(left.createdAt)).getTime(),
      )
      .slice(0, 6);

    const weeklyRuns = tasks
      .flatMap((task) =>
        task.runs && task.runs.length > 0
          ? task.runs.map((run) => serializeRun(run))
          : task.runHistory ?? [],
      )
      .filter(
        (run) => new Date(String(run.createdAt)).getTime() >= weekStart.getTime(),
      );

    return {
      activeSessions,
      weeklyTasks,
      weeklyCostUsd: this.roundCurrency(
        weeklyRuns.reduce((sum, run) => sum + Number(run.costUsd ?? 0), 0),
      ),
      weeklyTokens: weeklyRuns.reduce(
        (sum, run) => sum + Number(run.totalTokens ?? 0),
        0,
      ),
      recentRuns,
    };
  }

  private async findRole(userId: string, roleId: string) {
    const role = await this.rolesRepository.findOne({
      where: { id: roleId, project: { user: { id: userId } } },
      relations: { project: true },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    return role;
  }

  private async createProjectRecord(
    user: User,
    input: {
      name: string;
      description: string;
      githubRepo: string | null;
      githubBranchPrefix: string;
    },
  ) {
    const persistedUser = await this.usersRepository.findOneByOrFail({ id: user.id });
    const project = this.projectsRepository.create({
      user: persistedUser,
      name: input.name,
      description: input.description,
      githubRepo: input.githubRepo,
      githubBranchPrefix: input.githubBranchPrefix,
    });

    const savedProject = await this.projectsRepository.save(project);
    const roles = DEFAULT_ROLE_PRESETS.map((preset) =>
      this.rolesRepository.create({
        project: savedProject,
        slug: preset.slug,
        displayName: preset.displayName,
        modelPreference: preset.modelPreference,
        systemPromptTemplate: preset.systemPromptTemplate,
        toolAccessPolicy: [...preset.toolAccessPolicy],
      }),
    );

    await this.rolesRepository.save(roles);
    if (!persistedUser.onboardingCompleted) {
      persistedUser.onboardingCompleted = true;
      await this.usersRepository.save(persistedUser);
    }

    return savedProject;
  }

  private roundCurrency(value: number) {
    return Math.round(value * 10000) / 10000;
  }

  updateTaskRunHistory(task: TaskItem, run: AgentRun) {
    const serialized = serializeRun(run);
    const existing = Array.isArray(task.runHistory) ? task.runHistory : [];
    task.runHistory = [
      serialized,
      ...existing.filter((entry) => entry.id !== serialized.id),
    ].slice(0, 12);
    return this.tasksRepository.save(task);
  }

  private async hydrateTaskRuns(tasks: TaskItem[]) {
    const taskIds = [...new Set(tasks.map((task) => task.id).filter(Boolean))];
    if (taskIds.length === 0) {
      return;
    }

    const runs = await this.runsRepository.find({
      where: { task: { id: In(taskIds) } },
      relations: {
        task: true,
        role: { project: true },
      },
      order: { createdAt: 'DESC' },
    });
    const byTaskId = new Map<string, AgentRun[]>();
    runs.forEach((run) => {
      const taskId = run.task?.id;
      if (!taskId) {
        return;
      }
      const existing = byTaskId.get(taskId) ?? [];
      existing.push(run);
      byTaskId.set(taskId, existing);
    });

    tasks.forEach((task) => {
      task.runs = byTaskId.get(task.id) ?? [];
    });
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
