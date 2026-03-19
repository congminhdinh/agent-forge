export const TASK_STATUSES = [
  'backlog',
  'in_progress',
  'needs_review',
  'changes_requested',
  'done',
  'failed',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const DEFAULT_ROLE_PRESETS = [
  {
    slug: 'architect',
    displayName: 'Architect',
    modelPreference: 'anthropic:claude-3-5-haiku-latest',
    toolAccessPolicy: ['web_search'],
    systemPromptTemplate: [
      'You are the Architect for the project "{{project.name}}".',
      'Task: {{task.title}}',
      '',
      '{{task.description}}',
      '',
      'Produce a concise implementation plan and architecture guidance.',
    ].join('\n'),
  },
  {
    slug: 'developer',
    displayName: 'Developer',
    modelPreference: 'openai:gpt-4.1-mini',
    toolAccessPolicy: ['file_system'],
    systemPromptTemplate: [
      'You are the Developer for the project "{{project.name}}".',
      'Task: {{task.title}}',
      '',
      '{{task.description}}',
      '',
      'Produce an implementation summary, likely files to change, and delivery notes.',
    ].join('\n'),
  },
  {
    slug: 'reviewer',
    displayName: 'Reviewer',
    modelPreference: 'openai:gpt-4.1-mini',
    toolAccessPolicy: ['github_read'],
    systemPromptTemplate: [
      'You are the Reviewer for the project "{{project.name}}".',
      'Task: {{task.title}}',
      '',
      '{{task.description}}',
      '',
      'Review the proposed change and call out risks, missing tests, or approval notes.',
    ].join('\n'),
  },
  {
    slug: 'tester',
    displayName: 'Tester',
    modelPreference: 'anthropic:claude-3-5-haiku-latest',
    toolAccessPolicy: ['code_execution'],
    systemPromptTemplate: [
      'You are the Tester for the project "{{project.name}}".',
      'Task: {{task.title}}',
      '',
      '{{task.description}}',
      '',
      'List verification steps, likely tests, and any expected edge cases.',
    ].join('\n'),
  },
  {
    slug: 'debugger',
    displayName: 'Debugger',
    modelPreference: 'openai:gpt-4.1-mini',
    toolAccessPolicy: ['code_execution'],
    systemPromptTemplate: [
      'You are the Debugger for the project "{{project.name}}".',
      'Task: {{task.title}}',
      '',
      '{{task.description}}',
      '',
      'Describe likely failure modes, root causes, and next investigation steps.',
    ].join('\n'),
  },
] as const;
