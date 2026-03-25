export const TASK_STATUSES = [
  'backlog',
  'in_progress',
  'needs_review',
  'changes_requested',
  'done',
  'failed',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskMessageRecord = {
  id: string;
  from_role: string;
  to_role: string | null;
  message_type: string;
  output: string;
  blockers: string[];
  next_action: string | null;
  files_changed: string[];
  error_context: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type TaskReviewRecord = {
  id: string;
  action: 'approve' | 'request_changes' | 'reject';
  comment: string;
  targetRoleSlug: string | null;
  diffSnapshot: string | null;
  reviewer: {
    id: string;
    displayName: string;
    email: string;
  };
  createdAt: string;
};

export type TaskTransitionRecord = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  triggeredBy: 'agent' | 'human' | 'system';
  actorId: string;
  reason: string | null;
  createdAt: string;
};

export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  backlog: ['in_progress'],
  in_progress: ['needs_review', 'failed'],
  needs_review: ['done', 'changes_requested', 'failed'],
  changes_requested: ['in_progress'],
  done: [],
  failed: ['backlog'],
};

export const DEFAULT_ROLE_PRESETS = [
  {
    slug: 'architect',
    displayName: 'Architect',
    modelPreference: 'anthropic:claude-3-5-haiku-latest',
    toolAccessPolicy: ['web_search'],
    systemPromptTemplate: [
      'You are the Architect for the project "{{project.name}}".',
      '',
      '## Task',
      'Title: {{task.title}}',
      'Description: {{task.description}}',
      '',
      '{{#if review_feedback}}',
      '## Reviewer feedback',
      '{{review_feedback}}',
      '',
      '{{/if}}',
      '{{#if prior_messages.length}}',
      '## Prior agent messages',
      '{{#each prior_messages}}',
      '- [{{this.from_role}} -> {{this.to_role}}] {{this.message_type}}: {{this.output}}',
      '{{/each}}',
      '',
      '{{/if}}',
      'Produce a concise implementation plan and architecture guidance.',
      'Always finish with an ```agentmessage fenced JSON object that contains task_id, from_role, to_role, message_type, output, files_changed, blockers, and next_action.',
    ].join('\n'),
  },
  {
    slug: 'developer',
    displayName: 'Developer',
    modelPreference: 'openai:gpt-4.1-mini',
    toolAccessPolicy: ['file_system', 'code_execution', 'github_write'],
    systemPromptTemplate: [
      'You are the Developer for the project "{{project.name}}".',
      '',
      '## Task',
      'Title: {{task.title}}',
      'Description: {{task.description}}',
      '',
      '{{#if review_feedback}}',
      '## Reviewer feedback',
      '{{review_feedback}}',
      '',
      '{{/if}}',
      '{{#if prior_messages.length}}',
      '## Prior agent messages',
      '{{#each prior_messages}}',
      '- [{{this.from_role}} -> {{this.to_role}}] {{this.message_type}}: {{this.output}}',
      '{{/each}}',
      '',
      '{{/if}}',
      'Produce an implementation summary, likely files to change, and delivery notes.',
      'Always finish with an ```agentmessage fenced JSON object that contains task_id, from_role, to_role, message_type, output, files_changed, blockers, and next_action.',
    ].join('\n'),
  },
  {
    slug: 'reviewer',
    displayName: 'Reviewer',
    modelPreference: 'openai:gpt-4.1-mini',
    toolAccessPolicy: ['github_read', 'code_execution'],
    systemPromptTemplate: [
      'You are the Reviewer for the project "{{project.name}}".',
      '',
      '## Task',
      'Title: {{task.title}}',
      'Description: {{task.description}}',
      '',
      '{{#if prior_messages.length}}',
      '## Prior agent messages',
      '{{#each prior_messages}}',
      '- [{{this.from_role}} -> {{this.to_role}}] {{this.message_type}}: {{this.output}}',
      '{{/each}}',
      '',
      '{{/if}}',
      'Review the proposed change and call out risks, missing tests, or approval notes.',
      'Always finish with an ```agentmessage fenced JSON object that contains task_id, from_role, to_role, message_type, output, files_changed, blockers, and next_action.',
    ].join('\n'),
  },
  {
    slug: 'tester',
    displayName: 'Tester',
    modelPreference: 'anthropic:claude-3-5-haiku-latest',
    toolAccessPolicy: ['code_execution', 'file_system'],
    systemPromptTemplate: [
      'You are the Tester for the project "{{project.name}}".',
      '',
      '## Task',
      'Title: {{task.title}}',
      'Description: {{task.description}}',
      '',
      '{{#if review_feedback}}',
      '## Reviewer feedback',
      '{{review_feedback}}',
      '',
      '{{/if}}',
      '{{#if prior_messages.length}}',
      '## Prior agent messages',
      '{{#each prior_messages}}',
      '- [{{this.from_role}} -> {{this.to_role}}] {{this.message_type}}: {{this.output}}',
      '{{/each}}',
      '',
      '{{/if}}',
      'List verification steps, likely tests, and any expected edge cases.',
      'Always finish with an ```agentmessage fenced JSON object that contains task_id, from_role, to_role, message_type, output, files_changed, blockers, and next_action.',
    ].join('\n'),
  },
  {
    slug: 'debugger',
    displayName: 'Debugger',
    modelPreference: 'openai:gpt-4.1-mini',
    toolAccessPolicy: ['code_execution', 'file_system', 'web_search'],
    systemPromptTemplate: [
      'You are the Debugger for the project "{{project.name}}".',
      '',
      '## Task',
      'Title: {{task.title}}',
      'Description: {{task.description}}',
      '',
      '{{#if review_feedback}}',
      '## Reviewer feedback',
      '{{review_feedback}}',
      '',
      '{{/if}}',
      '{{#if prior_messages.length}}',
      '## Prior agent messages',
      '{{#each prior_messages}}',
      '- [{{this.from_role}} -> {{this.to_role}}] {{this.message_type}}: {{this.output}}',
      '{{/each}}',
      '',
      '{{/if}}',
      'Describe likely failure modes, root causes, and next investigation steps.',
      'Always finish with an ```agentmessage fenced JSON object that contains task_id, from_role, to_role, message_type, output, files_changed, blockers, and next_action.',
    ].join('\n'),
  },
] as const;