export const TASK_STATUSES = [
  'backlog',
  'in_progress',
  'blocked',
  'needs_review',
  'changes_requested',
  'done',
  'failed',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskRecoveryState =
  | 'healthy'
  | 'retryable'
  | 'blocked'
  | 'dead_letter';

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
  in_progress: ['blocked', 'needs_review', 'failed'],
  blocked: ['in_progress', 'failed'],
  needs_review: ['done', 'changes_requested', 'failed'],
  changes_requested: ['in_progress', 'blocked'],
  done: [],
  failed: ['backlog', 'in_progress'],
};

export type RoleTemplateRecord = {
  slug: string;
  displayName: string;
  systemPromptTemplate: string;
  modelPreference: string;
  toolAccessPolicy: readonly string[];
  summary: string;
  category: string;
};

export const DEFAULT_ROLE_PRESETS = [
  {
    slug: 'architect',
    displayName: 'Architect',
    modelPreference: 'anthropic:claude-3-5-haiku-latest',
    toolAccessPolicy: ['web_search'],
    summary: 'Breaks work down into architecture guidance and execution plans.',
    category: 'core',
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
    summary: 'Implements the task and reports concrete delivery notes.',
    category: 'core',
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
    summary: 'Performs the final quality pass before human approval.',
    category: 'core',
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
    summary: 'Builds verification steps, edge cases, and test guidance.',
    category: 'core',
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
    summary: 'Investigates failures, likely causes, and recovery paths.',
    category: 'core',
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

export const ROLE_TEMPLATE_LIBRARY: RoleTemplateRecord[] = [
  ...DEFAULT_ROLE_PRESETS,
  {
    slug: 'security-auditor',
    displayName: 'Security Auditor',
    modelPreference: 'openai:gpt-4.1-mini',
    toolAccessPolicy: ['github_read', 'web_search'],
    summary:
      'Checks authentication, secrets, validation boundaries, and abuse cases.',
    category: 'specialist',
    systemPromptTemplate: [
      'You are the Security Auditor for "{{project.name}}".',
      '',
      'Review the current task for auth gaps, unsafe defaults, secret handling, and abuse paths.',
      'Highlight concrete risks, severity, and what the next role should change.',
      'Always finish with an ```agentmessage fenced JSON object that contains task_id, from_role, to_role, message_type, output, files_changed, blockers, and next_action.',
    ].join('\n'),
  },
  {
    slug: 'delivery-manager',
    displayName: 'Delivery Manager',
    modelPreference: 'anthropic:claude-3-5-haiku-latest',
    toolAccessPolicy: ['github_read'],
    summary: 'Summarizes progress, blockers, rollout notes, and release readiness.',
    category: 'operations',
    systemPromptTemplate: [
      'You are the Delivery Manager for "{{project.name}}".',
      '',
      'Summarize what shipped, what remains risky, and what operators should verify next.',
      'Always finish with an ```agentmessage fenced JSON object that contains task_id, from_role, to_role, message_type, output, files_changed, blockers, and next_action.',
    ].join('\n'),
  },
  {
    slug: 'docs-writer',
    displayName: 'Docs Writer',
    modelPreference: 'openai:gpt-4.1-mini',
    toolAccessPolicy: ['github_read', 'file_system'],
    summary: 'Captures setup steps, user workflow changes, and operator runbooks.',
    category: 'specialist',
    systemPromptTemplate: [
      'You are the Docs Writer for "{{project.name}}".',
      '',
      'Produce concise user-facing or operator-facing documentation for the current task.',
      'Always finish with an ```agentmessage fenced JSON object that contains task_id, from_role, to_role, message_type, output, files_changed, blockers, and next_action.',
    ].join('\n'),
  },
];
