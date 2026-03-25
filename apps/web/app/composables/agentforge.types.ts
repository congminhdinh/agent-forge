export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  authProvider: string;
  isAdmin: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuthResponse = {
  accessToken: string;
  githubConfigured: boolean;
  user: AuthUser;
};

export type RoleRecord = {
  id: string;
  projectId: string;
  slug: string;
  displayName: string;
  systemPromptTemplate: string;
  modelPreference: string;
  toolAccessPolicy: string[];
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

export type RoleTemplateBundle = {
  projectId: string;
  projectName: string;
  exportedAt: string;
  roles: RoleTemplateRecord[];
};

export type AgentRun = {
  id: string;
  status: string;
  provider: string;
  model: string;
  prompt: string;
  rawOutput: string;
  summary: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  costSource: string;
  filesChanged: string[];
  error: string | null;
  handoffTarget: string | null;
  sandboxMode: string;
  sandboxStatus: string;
  sandboxDetails: Record<string, unknown> | null;
  durationMs: number | null;
  createdAt: string;
  finishedAt: string | null;
  role: RoleRecord | null;
};

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

export type TaskRecord = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  assignedRole: RoleRecord | null;
  modelOverride: string | null;
  latestSummary: string | null;
  reviewFeedback: string | null;
  reviewRequestedRoleSlug: string | null;
  github: {
    repo: string | null;
    branch: string | null;
    prNumber: number | null;
    prUrl: string | null;
    status: string | null;
    statusReason: string | null;
  };
  recovery: {
    retryCount: number;
    maxRetries: number;
    state: string;
    lastFailureReason: string | null;
    deadLetteredAt: string | null;
  };
  runs: AgentRun[];
  messages: TaskMessageRecord[];
  reviews: TaskReviewRecord[];
  transitions: TaskTransitionRecord[];
};

export type ProjectRecord = {
  id: string;
  name: string;
  description: string;
  githubRepo: string | null;
  githubBranchPrefix: string;
  roles: RoleRecord[];
  tasks: TaskRecord[];
};

export type ApiKeyState = {
  provider: 'openai' | 'anthropic';
  configured: boolean;
  updatedAt: string | null;
};

export type NotificationRecord = {
  id: string;
  kind: string;
  channel: string;
  level: string;
  title: string;
  message: string;
  taskId: string | null;
  projectId: string | null;
  status: string;
  destination: string | null;
  metadata: Record<string, unknown> | null;
  error: string | null;
  readAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationPreferences = {
  emailNotificationsEnabled: boolean;
  webhookNotificationsEnabled: boolean;
  notificationEmail: string | null;
  notificationWebhookUrl: string | null;
};

export type UsageSnapshot = {
  tier: string;
  status: string;
  sessions: {
    active: number;
    limit: number;
  };
  weekly_tasks: {
    used: number;
    limit: number;
    resetsAt: string;
  };
  weekly_cost_usd: number;
  weekly_tokens: number;
  recent_sessions: Array<{
    taskId: string;
    taskTitle: string;
    role: string;
    model: string;
    status: string;
    summary: string | null;
    durationSec: number | null;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
    costSource: string;
    createdAt: string;
    finishedAt: string | null;
  }>;
};

export type AdminUserRecord = {
  id: string;
  email: string;
  displayName: string;
  authProvider: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  maxConcurrentSessions: number;
  maxWeeklyTasks: number;
  isAdmin: boolean;
  onboardingCompleted: boolean;
  projectCount: number;
  activeTasks: number;
  blockedTasks: number;
  deadLetterTasks: number;
  weeklyCostUsd: number;
  weeklyTokens: number;
  unreadNotifications: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminSystemStats = {
  users: number;
  projects: number;
  tasks: number;
  notifications: number;
  tasksByStatus: Record<string, number>;
  weeklyCostUsd: number;
  weeklyTokens: number;
  queue: {
    mode: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  deadLetters: Array<{
    id: string;
    title: string;
    status: string;
    projectId: string | null;
    recoveryState: string;
    lastFailureReason: string | null;
    deadLetteredAt: string | null;
    updatedAt: string;
  }>;
  recentFailures: Array<{
    id: string;
    taskId: string | null;
    taskTitle: string;
    role: string;
    error: string | null;
    createdAt: string;
  }>;
  recentNotifications: Array<{
    id: string;
    kind: string;
    channel: string;
    status: string;
    userEmail: string | null;
    title: string;
    createdAt: string;
  }>;
};

export const boardColumns = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'needs_review', label: 'Needs Review' },
  { key: 'changes_requested', label: 'Changes' },
  { key: 'done', label: 'Done' },
  { key: 'failed', label: 'Failed' },
] as const;
