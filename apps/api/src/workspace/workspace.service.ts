import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import {
  CreateProjectDto,
  CreateRoleDto,
  CreateTaskDto,
  UpdateProjectDto,
  UpdateRoleDto,
  UpdateTaskDto,
} from './workspace.dto';
import { Project } from './project.entity';
import { AgentRole } from './role.entity';
import { serializeProject, serializeRole, serializeTask } from './workspace.serializer';
import { TaskItem } from './task.entity';
import { DEFAULT_ROLE_PRESETS, TASK_STATUSES } from './workspace.types';

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(AgentRole)
    private readonly rolesRepository: Repository<AgentRole>,
    @InjectRepository(TaskItem)
    private readonly tasksRepository: Repository<TaskItem>,
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

    return projects.map(serializeProject);
  }

  async getProject(user: User, projectId: string) {
    const project = await this.findProject(user.id, projectId);
    return serializeProject(project);
  }

  async createProject(user: User, body: CreateProjectDto) {
    const project = this.projectsRepository.create({
      user,
      name: body.name.trim(),
      description: body.description?.trim() ?? '',
      githubRepo: body.githubRepo?.trim() || null,
      githubBranchPrefix: body.githubBranchPrefix?.trim() || 'agentforge/',
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
    return this.getProject(user, savedProject.id);
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
      task.status = body.status;
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

    return project;
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
}
