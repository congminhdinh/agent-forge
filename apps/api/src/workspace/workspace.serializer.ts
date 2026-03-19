import { AgentRun } from '../agent/agent-run.entity';
import { Project } from './project.entity';
import { AgentRole } from './role.entity';
import { TaskItem } from './task.entity';

export const serializeRole = (role: AgentRole) => ({
  id: role.id,
  projectId: role.project?.id,
  slug: role.slug,
  displayName: role.displayName,
  systemPromptTemplate: role.systemPromptTemplate,
  modelPreference: role.modelPreference,
  toolAccessPolicy: role.toolAccessPolicy ?? [],
  createdAt: role.createdAt,
  updatedAt: role.updatedAt,
});

export const serializeRun = (run: AgentRun) => ({
  id: run.id,
  taskId: run.task?.id,
  role: run.role ? serializeRole(run.role) : null,
  status: run.status,
  provider: run.provider,
  model: run.model,
  prompt: run.prompt,
  rawOutput: run.rawOutput,
  summary: run.summary,
  filesChanged: run.filesChanged ?? [],
  error: run.error,
  finishedAt: run.finishedAt,
  createdAt: run.createdAt,
  updatedAt: run.updatedAt,
});

export const serializeTask = (task: TaskItem) => ({
  id: task.id,
  projectId: task.project?.id,
  title: task.title,
  description: task.description,
  status: task.status,
  priority: task.priority,
  assignedRole: task.assignedRole ? serializeRole(task.assignedRole) : null,
  modelOverride: task.modelOverride,
  latestSummary: task.latestSummary,
  runs: (task.runs ?? [])
    .slice()
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .map(serializeRun),
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
});

export const serializeProject = (project: Project) => ({
  id: project.id,
  userId: project.user?.id,
  name: project.name,
  description: project.description,
  githubRepo: project.githubRepo,
  githubBranchPrefix: project.githubBranchPrefix,
  roles: (project.roles ?? [])
    .slice()
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
    .map(serializeRole),
  tasks: (project.tasks ?? [])
    .slice()
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    )
    .map(serializeTask),
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
});
