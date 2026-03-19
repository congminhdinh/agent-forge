import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  UnprocessableEntityException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { Queue, Worker } from 'bullmq';
import { generateText } from 'ai';
import Handlebars from 'handlebars';
import { Repository } from 'typeorm';
import { SettingsService } from '../settings/settings.service';
import { User } from '../users/user.entity';
import { serializeTask } from '../workspace/workspace.serializer';
import { WorkspaceService } from '../workspace/workspace.service';
import { AgentRun } from './agent-run.entity';

type DispatchJob = {
  taskId: string;
  userId: string;
};

@Injectable()
export class AgentService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue<DispatchJob> | null = null;
  private worker: Worker<DispatchJob> | null = null;

  constructor(
    @Inject(forwardRef(() => WorkspaceService))
    private readonly workspaceService: WorkspaceService,
    private readonly settingsService: SettingsService,
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
        await this.executeTask(job.data.userId, job.data.taskId);
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

    task.status = 'in_progress';
    await this.workspaceService.saveTask(task);

    if (this.queue) {
      await this.queue.add('dispatch', { taskId, userId: user.id });
      return this.workspaceService.getTask(user, taskId);
    }

    await this.executeTask(user.id, taskId);
    const updatedTask = await this.workspaceService.findTask(user.id, taskId);
    return serializeTask(updatedTask);
  }

  private async executeTask(userId: string, taskId: string) {
    const task = await this.workspaceService.findTask(userId, taskId);
    if (!task.assignedRole) {
      throw new UnprocessableEntityException(
        'Assigned role was removed before dispatch.',
      );
    }

    const preference = task.modelOverride || task.assignedRole.modelPreference;
    const [provider, model] = preference.includes(':')
      ? preference.split(':', 2)
      : ['mock', preference];
    const prompt = Handlebars.compile(task.assignedRole.systemPromptTemplate)({
      project: task.project,
      task,
      current_role: task.assignedRole.slug,
    });

    let run = this.runsRepository.create({
      task,
      role: task.assignedRole,
      provider,
      model,
      prompt,
      rawOutput: '',
      summary: null,
      filesChanged: [],
      status: 'running',
      error: null,
      finishedAt: null,
    });

    run = await this.runsRepository.save(run);

    const result = await this.generateAgentOutput(
      userId,
      provider,
      model,
      prompt,
      task.title,
    );
    run.status = result.status;
    run.rawOutput = result.output;
    run.summary = result.summary;
    run.filesChanged = result.filesChanged;
    run.error = result.error;
    run.finishedAt = new Date();
    await this.runsRepository.save(run);

    task.latestSummary = result.summary;
    task.status = result.status === 'failed' ? 'failed' : 'needs_review';
    await this.workspaceService.saveTask(task);
  }

  private async generateAgentOutput(
    userId: string,
    provider: string,
    model: string,
    prompt: string,
    taskTitle: string,
  ) {
    const providerKey =
      provider === 'openai' || provider === 'anthropic'
        ? await this.settingsService.getProviderKey(userId, provider)
        : null;

    if (provider === 'openai' && providerKey) {
      return this.runRemoteModel(
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
      );
    }

    if (provider === 'anthropic' && providerKey) {
      return this.runRemoteModel(
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
      );
    }

    const offlineReason = providerKey
      ? `Provider "${provider}" is unsupported by the MVP router.`
      : `No ${provider} API key is configured, so the task ran in MVP mock mode.`;
    const output = [
      `Task: ${taskTitle}`,
      '',
      'AgentForge Phase 1 mock execution',
      offlineReason,
      '',
      'Rendered prompt:',
      prompt,
      '',
      'Suggested next steps:',
      '- Review the prompt and assign a real provider key to run against a live model.',
      '- Update the task status manually on the board after review.',
    ].join('\n');

    return {
      status: 'completed',
      summary: this.buildSummary(output),
      output,
      filesChanged: [],
      error: null,
    };
  }

  private async runRemoteModel(
    runModel: () => Promise<string>,
    provider: string,
    model: string,
  ) {
    try {
      const output = await runModel();
      return {
        status: 'completed',
        summary: this.buildSummary(output),
        output,
        filesChanged: [],
        error: null,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown provider error';
      const fallbackOutput = [
        `Live ${provider}:${model} execution failed.`,
        '',
        `Error: ${message}`,
        '',
        'The task remains usable in Phase 1, but the output below is a fallback summary.',
      ].join('\n');

      return {
        status: 'completed',
        summary: this.buildSummary(fallbackOutput),
        output: fallbackOutput,
        filesChanged: [],
        error: message,
      };
    }
  }

  private buildSummary(output: string) {
    const compact = output.replace(/\s+/g, ' ').trim();
    return compact.length <= 220 ? compact : `${compact.slice(0, 217)}...`;
  }
}
