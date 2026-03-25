import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  UnprocessableEntityException,
  forwardRef,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { Queue, Worker } from 'bullmq';
import { generateText } from 'ai';
import Handlebars from 'handlebars';
import { Repository } from 'typeorm';
import { SettingsService } from '../settings/settings.service';
import { RealtimeService } from '../realtime.service';
import { User } from '../users/user.entity';
import { serializeTask } from '../workspace/workspace.serializer';
import { AgentRole } from '../workspace/role.entity';
import { SubmitReviewDto } from '../workspace/workspace.dto';
import { TaskItem } from '../workspace/task.entity';
import {
  TaskMessageRecord,
  TaskReviewRecord,
} from '../workspace/workspace.types';
import { WorkspaceService } from '../workspace/workspace.service';
import { AgentRun } from './agent-run.entity';

type DispatchJob = {
  taskId: string;
  userId: string;
};

type AgentResult = {
  status: 'completed' | 'failed';
  summary: string | null;
  output: string;
  filesChanged: string[];
  error: string | null;
  message: TaskMessageRecord;
};

const DEFAULT_HANDOFFS: Record<string, string | null> = {
  architect: 'developer',
  developer: 'tester',
  tester: 'reviewer',
  debugger: 'developer',
  reviewer: null,
};

@Injectable()
export class AgentService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue<DispatchJob> | null = null;
  private worker: Worker<DispatchJob> | null = null;

  constructor(
    @Inject(forwardRef(() => WorkspaceService))
    private readonly workspaceService: WorkspaceService,
    private readonly realtimeService: RealtimeService,
    private readonly settingsService: SettingsService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(AgentRun)
    private readonly runsRepository: Repository<AgentRun>,
  ) {}

  async onModuleInit() {
    if (!process.env.REDIS_URL) {
      return;
    }

    const connection = { url: process.env.REDIS_URL };
    this.queue = new Queue<DispatchJob>('agent-dispatch', { connection });
    this.worker = new Worker<DispatchJob>(
      'agent-dispatch',
      async (job) => {
        await this.executeWorkflow(job.data.userId, job.data.taskId);
      },
      { connection },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async dispatchTask(user: User, taskId: string) {
    const task = await this.workspaceService.findTask(user.id, taskId);
    if (!task.assignedRole) {
      throw new UnprocessableEntityException(
        'Assign a role before dispatching the task.',
      );
    }

    if (!['backlog', 'changes_requested'].includes(task.status)) {
      throw new UnprocessableEntityException(
        'Only backlog or changes-requested tasks can be dispatched.',
      );
    }

    await this.assertCanDispatch(user);
    const fromStatus = task.status;
    await this.workspaceService.transitionTaskStatus(task, 'in_progress', {
      triggeredBy: 'human',
      actorId: user.id,
      reason: 'Queued for multi-agent execution.',
    });
    await this.workspaceService.saveTask(task);
    await this.emitTaskStatus(task, fromStatus, 'in_progress', 'human', user.id);

    if (this.queue) {
      await this.queue.add('dispatch', { taskId, userId: user.id });
      return this.workspaceService.getTask(user, taskId);
    }

    await this.executeWorkflow(user.id, taskId);
    return this.workspaceService.getTask(user, taskId);
  }

  async listReviews(user: User, taskId: string) {
    const task = await this.workspaceService.findTask(user.id, taskId);
    return serializeTask(task).reviews;
  }

  async submitReview(user: User, taskId: string, body: SubmitReviewDto) {
    const task = await this.workspaceService.findTask(user.id, taskId);
    if (task.status !== 'needs_review') {
      throw new UnprocessableEntityException(
        'Only tasks waiting for human review can accept review decisions.',
      );
    }

    const comment = body.comment?.trim() ?? '';
    const targetRoleSlug =
      body.action === 'request_changes'
        ? body.targetRoleSlug?.trim() ||
          task.reviewRequestedRoleSlug ||
          task.project.roles.find((role) => role.slug === 'developer')?.slug ||
          task.project.roles[0]?.slug
        : null;

    const reviewRecord: TaskReviewRecord = {
      id: randomUUID(),
      action: body.action,
      comment,
      targetRoleSlug,
      diffSnapshot: this.buildDiffSnapshot(task),
      reviewer: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
      },
      createdAt: new Date().toISOString(),
    };
    await this.workspaceService.appendTaskReview(task, reviewRecord);

    if (body.action === 'approve') {
      const fromStatus = task.status;
      this.applyGithubDecision(task, 'approve');
      await this.workspaceService.transitionTaskStatus(task, 'done', {
        triggeredBy: 'human',
        actorId: user.id,
        reason: comment || 'Approved during the human review gate.',
      });
      await this.workspaceService.saveTask(task);
      this.realtimeService.emitTask(task.id, 'review_completed', {
        taskId: task.id,
        action: body.action,
      });
      await this.emitTaskStatus(task, fromStatus, 'done', 'human', user.id);
      return this.workspaceService.getTask(user, task.id);
    }

    if (body.action === 'reject') {
      const fromStatus = task.status;
      this.applyGithubDecision(task, 'reject');
      await this.workspaceService.transitionTaskStatus(task, 'failed', {
        triggeredBy: 'human',
        actorId: user.id,
        reason: comment || 'Rejected during the human review gate.',
      });
      await this.workspaceService.saveTask(task);
      this.realtimeService.emitTask(task.id, 'review_completed', {
        taskId: task.id,
        action: body.action,
      });
      await this.emitTaskStatus(task, fromStatus, 'failed', 'human', user.id);
      return this.workspaceService.getTask(user, task.id);
    }

    if (!targetRoleSlug) {
      throw new UnprocessableEntityException(
        'Select a target role when requesting changes.',
      );
    }

    const targetRole = await this.workspaceService.findRoleBySlug(
      user.id,
      task.project.id,
      targetRoleSlug,
    );
    const fromStatus = task.status;
    task.assignedRole = targetRole;
    task.reviewFeedback = comment || 'Human review requested follow-up changes.';
    task.reviewRequestedRoleSlug = targetRole.slug;
    this.applyGithubDecision(task, 'request_changes');
    await this.workspaceService.transitionTaskStatus(task, 'changes_requested', {
      triggeredBy: 'human',
      actorId: user.id,
      reason: task.reviewFeedback,
    });
    await this.workspaceService.saveTask(task);
    this.realtimeService.emitTask(task.id, 'review_completed', {
      taskId: task.id,
      action: body.action,
    });
    await this.emitTaskStatus(
      task,
      fromStatus,
      'changes_requested',
      'human',
      user.id,
    );
    return this.dispatchTask(user, task.id);
  }

  async getSubscriptionSummary(user: User) {
    return {
      tier: user.subscriptionTier,
      status: user.subscriptionStatus,
      maxConcurrentSessions: user.maxConcurrentSessions,
      maxWeeklyTasks: user.maxWeeklyTasks,
      usage: await this.getUsageSummary(user),
    };
  }

  async getUsageSummary(user: User) {
    const facts = await this.workspaceService.getUsageFacts(user.id);
    return {
      tier: user.subscriptionTier,
      status: user.subscriptionStatus,
      sessions: {
        active: facts.activeSessions,
        limit: user.maxConcurrentSessions,
      },
      weekly_tasks: {
        used: facts.weeklyTasks,
        limit: user.maxWeeklyTasks,
        resetsAt: this.nextUtcWeekReset().toISOString(),
      },
      recent_sessions: facts.recentRuns,
    };
  }

  private async executeWorkflow(userId: string, taskId: string) {
    let task = await this.workspaceService.findTask(userId, taskId);
    const visitedRoles: string[] = [];

    while (task.status === 'in_progress' && task.assignedRole) {
      if (visitedRoles.length >= Math.max(task.project.roles.length + 1, 3)) {
        const fromStatus = task.status;
        this.applyGithubMetadata(task, []);
        await this.workspaceService.transitionTaskStatus(task, 'needs_review', {
          triggeredBy: 'system',
          actorId: 'agent-loop-guard',
          reason:
            'The workflow hit the Phase 2 safety limit for automatic role handoffs.',
        });
        await this.workspaceService.saveTask(task);
        await this.emitTaskStatus(
          task,
          fromStatus,
          'needs_review',
          'system',
          userId,
        );
        break;
      }

      const currentRole = task.assignedRole;
      visitedRoles.push(currentRole.slug);
      const sandbox = this.buildSandboxSnapshot(currentRole);
      const prompt = this.renderPrompt(task, currentRole);
      const preference = task.modelOverride || currentRole.modelPreference;
      const [provider, model] = preference.includes(':')
        ? preference.split(':', 2)
        : ['mock', preference];

      let run = this.runsRepository.create({
        task,
        role: currentRole,
        provider,
        model,
        prompt,
        rawOutput: '',
        summary: null,
        filesChanged: [],
        status: 'running',
        error: null,
        handoffTarget: null,
        sandboxMode: sandbox.mode,
        sandboxStatus: sandbox.status,
        sandboxDetails: sandbox.details,
        finishedAt: null,
      });

      run = await this.runsRepository.save(run);
      this.realtimeService.emitTask(task.id, 'agent_session_started', {
        taskId: task.id,
        sessionId: run.id,
        role: currentRole.slug,
        model: `${provider}:${model}`,
      });
      this.realtimeService.emitProject(task.project.id, 'agent_session_started', {
        taskId: task.id,
        sessionId: run.id,
        role: currentRole.slug,
        model: `${provider}:${model}`,
      });

      const result = await this.generateAgentOutput(
        userId,
        provider,
        model,
        prompt,
        task,
        currentRole,
      );
      run.status = result.status;
      run.rawOutput = result.output;
      run.summary = result.summary;
      run.filesChanged = result.filesChanged;
      run.error = result.error;
      run.handoffTarget = result.message.to_role;
      run.finishedAt = new Date();
      await this.runsRepository.save(run);

      task.latestSummary = result.summary;
      if (task.reviewFeedback) {
        task.reviewFeedback = null;
      }
      task.reviewRequestedRoleSlug = null;
      await this.workspaceService.appendTaskMessage(task, result.message);

      this.realtimeService.emitTask(task.id, 'agent_message_created', {
        taskId: task.id,
        message: result.message,
      });
      this.realtimeService.emitProject(task.project.id, 'agent_message_created', {
        taskId: task.id,
        message: result.message,
      });
      this.realtimeService.emitTask(task.id, 'agent_session_ended', {
        taskId: task.id,
        sessionId: run.id,
        status: run.status,
        handoffTarget: run.handoffTarget,
      });
      this.realtimeService.emitProject(task.project.id, 'agent_session_ended', {
        taskId: task.id,
        sessionId: run.id,
        status: run.status,
        handoffTarget: run.handoffTarget,
      });

      if (result.status === 'failed') {
        const fromStatus = task.status;
        await this.workspaceService.transitionTaskStatus(task, 'failed', {
          triggeredBy: 'agent',
          actorId: run.id,
          reason: result.error || 'The agent workflow reported a failure.',
        });
        await this.workspaceService.saveTask(task);
        await this.emitTaskStatus(task, fromStatus, 'failed', 'agent', userId);
        break;
      }

      const nextRole = this.resolveNextRole(task, currentRole, result.message);
      if (nextRole) {
        task.assignedRole = nextRole;
        await this.workspaceService.saveTask(task);
        task = await this.workspaceService.findTask(userId, taskId);
        continue;
      }

      const fromStatus = task.status;
      this.applyGithubMetadata(task, result.message.files_changed);
      await this.workspaceService.transitionTaskStatus(task, 'needs_review', {
        triggeredBy: 'agent',
        actorId: run.id,
        reason:
          result.message.next_action ||
          `Workflow completed through ${currentRole.displayName} and is waiting for human review.`,
      });
      await this.workspaceService.saveTask(task);
      await this.emitTaskStatus(
        task,
        fromStatus,
        'needs_review',
        'agent',
        userId,
      );
      break;
    }
  }

  private async generateAgentOutput(
    userId: string,
    provider: string,
    model: string,
    prompt: string,
    task: TaskItem,
    currentRole: AgentRole,
  ): Promise<AgentResult> {
    const providerKey =
      provider === 'openai' || provider === 'anthropic'
        ? await this.settingsService.getProviderKey(userId, provider)
        : null;
    let output: string;
    let error: string | null = null;

    if (provider === 'openai' && providerKey) {
      ({ output, error } = await this.runRemoteModel(
        async () => {
          const openai = createOpenAI({ apiKey: providerKey });
          const response = await generateText({
            model: openai(model),
            prompt,
          });
          return response.text;
        },
        provider,
        model,
        task,
        currentRole,
      ));
    } else if (provider === 'anthropic' && providerKey) {
      ({ output, error } = await this.runRemoteModel(
        async () => {
          const anthropic = createAnthropic({ apiKey: providerKey });
          const response = await generateText({
            model: anthropic(model),
            prompt,
          });
          return response.text;
        },
        provider,
        model,
        task,
        currentRole,
      ));
    } else {
      const offlineReason = providerKey
        ? `Provider "${provider}" is unsupported by the Phase 2 router.`
        : `No ${provider} API key is configured, so the task ran in the local Phase 2 workflow fallback.`;
      output = this.buildFallbackOutput(task, currentRole, prompt, offlineReason);
    }

    const message = this.normalizeMessage(task, currentRole, output, error);
    return {
      status: 'completed',
      summary: this.buildSummary(message.output || output),
      output,
      filesChanged: message.files_changed,
      error,
      message,
    };
  }

  private async runRemoteModel(
    runModel: () => Promise<string>,
    provider: string,
    model: string,
    task: TaskItem,
    currentRole: AgentRole,
  ) {
    try {
      return {
        output: await runModel(),
        error: null,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown provider error';
      return {
        output: this.buildFallbackOutput(
          task,
          currentRole,
          '',
          `Live ${provider}:${model} execution failed with: ${message}`,
        ),
        error: message,
      };
    }
  }

  private normalizeMessage(
    task: TaskItem,
    currentRole: AgentRole,
    output: string,
    error: string | null,
  ): TaskMessageRecord {
    const match = output.match(/```agentmessage\s*([\s\S]*?)```/i);
    if (match) {
      try {
        const parsed = JSON.parse(match[1].trim()) as Record<string, unknown>;
        return {
          id: randomUUID(),
          from_role:
            typeof parsed.from_role === 'string' ? parsed.from_role : currentRole.slug,
          to_role: this.normalizeRoleTarget(
            task,
            typeof parsed.to_role === 'string' ? parsed.to_role : null,
            currentRole,
          ),
          message_type:
            typeof parsed.message_type === 'string'
              ? parsed.message_type
              : DEFAULT_HANDOFFS[currentRole.slug]
                ? 'handoff'
                : 'status_update',
          output:
            typeof parsed.output === 'string' && parsed.output.trim().length > 0
              ? parsed.output.trim()
              : output,
          blockers: Array.isArray(parsed.blockers)
            ? parsed.blockers.filter((entry): entry is string => typeof entry === 'string')
            : [],
          next_action:
            typeof parsed.next_action === 'string' ? parsed.next_action : null,
          files_changed: Array.isArray(parsed.files_changed)
            ? parsed.files_changed.filter(
                (entry): entry is string => typeof entry === 'string',
              )
            : [],
          error_context: error ? { providerError: error } : null,
          metadata: {
            source: 'parsed',
          },
          createdAt: new Date().toISOString(),
        };
      } catch {
        // Fall back to default routing below.
      }
    }

    const nextRole = this.resolveFallbackRole(task, currentRole);
    return {
      id: randomUUID(),
      from_role: currentRole.slug,
      to_role: nextRole?.slug ?? null,
      message_type: nextRole ? 'handoff' : 'status_update',
      output,
      blockers: error ? [error] : [],
      next_action: nextRole
        ? `Continue the workflow with ${nextRole.displayName}.`
        : 'Wait for a human review decision.',
      files_changed: [],
      error_context: error ? { providerError: error } : null,
      metadata: {
        source: 'fallback',
      },
      createdAt: new Date().toISOString(),
    };
  }

  private resolveNextRole(
    task: TaskItem,
    currentRole: AgentRole,
    message: TaskMessageRecord,
  ) {
    if (currentRole.slug === 'reviewer') {
      return null;
    }

    if (message.to_role) {
      const explicit = task.project.roles.find((role) => role.slug === message.to_role);
      if (explicit) {
        return explicit;
      }
    }

    return this.resolveFallbackRole(task, currentRole);
  }

  private resolveFallbackRole(task: TaskItem, currentRole: AgentRole) {
    const slug = DEFAULT_HANDOFFS[currentRole.slug];
    if (!slug) {
      return null;
    }

    return task.project.roles.find((role) => role.slug === slug) ?? null;
  }

  private normalizeRoleTarget(
    task: TaskItem,
    toRole: string | null,
    currentRole: AgentRole,
  ) {
    if (!toRole || toRole === 'null') {
      return this.resolveFallbackRole(task, currentRole)?.slug ?? null;
    }

    const normalized = toRole.trim();
    if (normalized.length === 0) {
      return this.resolveFallbackRole(task, currentRole)?.slug ?? null;
    }

    return task.project.roles.some((role) => role.slug === normalized)
      ? normalized
      : this.resolveFallbackRole(task, currentRole)?.slug ?? null;
  }

  private renderPrompt(task: TaskItem, role: AgentRole) {
    return Handlebars.compile(role.systemPromptTemplate)({
      project: task.project,
      task,
      task_id: task.id,
      current_role: role.slug,
      prior_messages: Array.isArray(task.messages) ? task.messages : [],
      review_feedback: task.reviewFeedback,
    });
  }

  private buildFallbackOutput(
    task: TaskItem,
    currentRole: AgentRole,
    prompt: string,
    reason: string,
  ) {
    const nextRole = this.resolveFallbackRole(task, currentRole);
    const protocol = {
      task_id: task.id,
      from_role: currentRole.slug,
      to_role: nextRole?.slug ?? null,
      message_type: nextRole ? 'handoff' : 'status_update',
      output: `${currentRole.displayName} completed the Phase 2 fallback workflow for "${task.title}".`,
      files_changed: [],
      blockers: [],
      next_action: nextRole
        ? `Route this task to ${nextRole.displayName}.`
        : 'Present the completed workflow to a human reviewer.',
    };

    return [
      `Task: ${task.title}`,
      `Role: ${currentRole.displayName}`,
      '',
      'AgentForge Phase 2 workflow fallback',
      reason,
      ...(prompt ? ['', 'Rendered prompt:', prompt] : []),
      '',
      '```agentmessage',
      JSON.stringify(protocol, null, 2),
      '```',
    ].join('\n');
  }

  private buildSandboxSnapshot(role: AgentRole | null) {
    const requiresCodeExecution = role?.toolAccessPolicy?.includes('code_execution');
    if (!requiresCodeExecution) {
      return {
        mode: 'none',
        status: 'not_required',
        details: null,
      };
    }

    const timeoutSec = Number(process.env.SANDBOX_TIMEOUT_SEC ?? '300');
    const memoryLimit = process.env.SANDBOX_MEMORY_LIMIT ?? '512m';
    const cpuLimit = process.env.SANDBOX_CPU_LIMIT ?? '0.5';
    const dockerEnabled = process.env.SANDBOX_RUNTIME === 'docker';

    if (dockerEnabled) {
      return {
        mode: 'docker',
        status: 'configured',
        details: {
          memoryLimit,
          cpuLimit,
          timeoutSec,
        },
      };
    }

    return {
      mode: 'workspace_fallback',
      status: 'fallback',
      details: {
        memoryLimit,
        cpuLimit,
        timeoutSec,
        reason:
          'Docker sandboxing is not configured in this environment, so Phase 2 records the request and falls back to the app workspace.',
      },
    };
  }

  private applyGithubMetadata(task: TaskItem, filesChanged: string[]) {
    if (!task.project.githubRepo) {
      task.githubStatus = 'not_configured';
      task.githubStatusReason =
        'Connect a GitHub repository to generate branch and compare metadata.';
      task.githubBranch = null;
      task.githubPrUrl = null;
      task.githubPrNumber = null;
      return;
    }

    const branch =
      task.githubBranch ??
      this.buildBranchName(task.project.githubBranchPrefix, task.title, task.id);

    task.githubBranch = branch;
    task.githubPrUrl = `https://github.com/${task.project.githubRepo}/compare/${encodeURIComponent(branch)}?expand=1`;
    task.githubStatus = filesChanged.length > 0 ? 'draft_ready' : 'awaiting_changes';
    task.githubStatusReason =
      filesChanged.length > 0
        ? `Prepared a compare link for ${filesChanged.length} reported file change(s).`
        : 'The workflow reached review, but the agent did not report concrete file changes.';
  }

  private applyGithubDecision(
    task: TaskItem,
    action: 'approve' | 'request_changes' | 'reject',
  ) {
    if (!task.project.githubRepo) {
      return;
    }

    if (action === 'approve') {
      task.githubStatus = 'approved';
      task.githubStatusReason =
        'Human review approved the task. Merge the GitHub branch once the repository changes are ready.';
      return;
    }

    if (action === 'request_changes') {
      task.githubStatus = 'changes_requested';
      task.githubStatusReason =
        'Human review requested changes before a GitHub handoff can be finalized.';
      return;
    }

    task.githubStatus = 'rejected';
    task.githubStatusReason =
      'Human review rejected the task and closed the current GitHub handoff path.';
  }

  private buildBranchName(prefix: string, title: string, taskId: string) {
    const normalizedPrefix = prefix?.trim() ? prefix.trim() : 'agentforge/';
    const safePrefix = normalizedPrefix.endsWith('/')
      ? normalizedPrefix
      : `${normalizedPrefix}/`;
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);

    return `${safePrefix}${slug || 'task'}-${taskId.slice(0, 8)}`;
  }

  private buildDiffSnapshot(task: TaskItem) {
    const files = (task.runs ?? []).flatMap((run) => run.filesChanged ?? []);
    const uniqueFiles = [...new Set(files)];
    const compareLink = task.githubPrUrl ? `Compare: ${task.githubPrUrl}` : null;
    return [compareLink, uniqueFiles.length ? `Files: ${uniqueFiles.join(', ')}` : null]
      .filter(Boolean)
      .join('\n');
  }

  private buildSummary(output: string) {
    const compact = output.replace(/\s+/g, ' ').trim();
    return compact.length <= 220 ? compact : `${compact.slice(0, 217)}...`;
  }

  private async assertCanDispatch(user: User) {
    if (user.subscriptionStatus !== 'active') {
      throw new UnprocessableEntityException(
        `Subscription status "${user.subscriptionStatus}" does not allow dispatching new tasks.`,
      );
    }

    const usage = await this.workspaceService.getUsageFacts(user.id);
    if (usage.activeSessions >= user.maxConcurrentSessions) {
      throw new UnprocessableEntityException(
        `Concurrent session limit reached (${usage.activeSessions}/${user.maxConcurrentSessions}). Wait for a task to finish before dispatching another.`,
      );
    }

    if (usage.weeklyTasks >= user.maxWeeklyTasks) {
      throw new UnprocessableEntityException(
        `Weekly task limit reached (${usage.weeklyTasks}/${user.maxWeeklyTasks}).`,
      );
    }
  }

  private async emitTaskStatus(
    task: TaskItem,
    fromStatus: string,
    toStatus: string,
    triggeredBy: 'agent' | 'human' | 'system',
    userId: string,
  ) {
    this.realtimeService.emitTask(task.id, 'task_status_changed', {
      taskId: task.id,
      fromStatus,
      toStatus,
      triggeredBy,
    });
    this.realtimeService.emitProject(task.project.id, 'task_status_changed', {
      taskId: task.id,
      fromStatus,
      toStatus,
      triggeredBy,
    });
    await this.emitUsage(userId);
  }

  private async emitUsage(userId: string) {
    const user = await this.usersRepository.findOneByOrFail({ id: userId });
    const usage = await this.getUsageSummary(user);
    this.realtimeService.emitUsage(userId, 'quota_updated', {
      usage,
    });
  }

  private nextUtcWeekReset(input = new Date()) {
    const date = new Date(
      Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()),
    );
    const weekday = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - weekday + 7);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }
}