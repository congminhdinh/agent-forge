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
  inputTokens: run.inputTokens ?? 0,
  outputTokens: run.outputTokens ?? 0,
  totalTokens: run.totalTokens ?? 0,
  costUsd: run.costUsd ?? 0,
  costSource: run.costSource ?? 'estimated',
  filesChanged: run.filesChanged ?? [],
  error: run.error,
  handoffTarget: run.handoffTarget,
  sandboxMode: run.sandboxMode,
  sandboxStatus: run.sandboxStatus,
  sandboxDetails: run.sandboxDetails,
  durationMs: run.durationMs,
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
  reviewFeedback: task.reviewFeedback,
  reviewRequestedRoleSlug: task.reviewRequestedRoleSlug,
  github: {
    repo: task.project?.githubRepo ?? null,
    branch: task.githubBranch,
    prNumber: task.githubPrNumber,
    prUrl: task.githubPrUrl,
    status: task.githubStatus,
    statusReason: task.githubStatusReason,
  },
  recovery: {
    retryCount: task.retryCount ?? 0,
    maxRetries: task.maxRetries ?? 0,
    state: task.recoveryState ?? 'healthy',
    lastFailureReason: task.lastFailureReason ?? null,
    deadLetteredAt: task.deadLetteredAt ?? null,
  },
  runs:
    task.runs && task.runs.length > 0
      ? task.runs
          .slice()
          .sort(
            (left, right) =>
              new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
          )
          .map(serializeRun)
      : (task.runHistory ?? [])
          .slice()
          .sort(
            (left, right) =>
              new Date(String(right.createdAt)).getTime() -
              new Date(String(left.createdAt)).getTime(),
          ),
  messages: (task.messages ?? [])
    .slice()
    .sort(
      (left, right) =>
        new Date(left.createdAt as string).getTime() -
        new Date(right.createdAt as string).getTime(),
    ),
  reviews: (task.reviews ?? [])
    .slice()
    .sort(
      (left, right) =>
        new Date(right.createdAt as string).getTime() -
        new Date(left.createdAt as string).getTime(),
    ),
  transitions: (task.transitions ?? [])
    .slice()
    .sort(
      (left, right) =>
        new Date(left.createdAt as string).getTime() -
        new Date(right.createdAt as string).getTime(),
    ),
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
