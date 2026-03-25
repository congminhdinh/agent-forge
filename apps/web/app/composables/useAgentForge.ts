import type {
  AdminSystemStats,
  AdminUserRecord,
  ApiKeyState,
  AuthResponse,
  NotificationPreferences,
  NotificationRecord,
  ProjectRecord,
  RoleRecord,
  RoleTemplateBundle,
  RoleTemplateRecord,
  UsageSnapshot,
} from './agentforge.types';

export const useAgentForge = () => {
  const config = useRuntimeConfig();
  const apiBase = computed(
    () => config.public.apiBaseUrl || 'http://localhost:3001',
  );

  const token = ref('');
  const session = ref<AuthResponse['user'] | null>(null);
  const githubConfigured = ref(false);
  const apiKeys = ref<ApiKeyState[]>([]);
  const usage = ref<UsageSnapshot | null>(null);
  const projects = ref<ProjectRecord[]>([]);
  const notifications = ref<NotificationRecord[]>([]);
  const roleTemplateLibrary = ref<RoleTemplateRecord[]>([]);
  const adminUsers = ref<AdminUserRecord[]>([]);
  const adminSystemStats = ref<AdminSystemStats | null>(null);
  const selectedProjectId = ref<string | null>(null);
  const selectedTaskId = ref<string | null>(null);
  const editingRoleId = ref<string | null>(null);
  const loading = ref(false);
  const actionMessage = ref('');
  const errorMessage = ref('');
  const draggingTaskId = ref<string | null>(null);

  let projectStream: EventSource | null = null;
  let taskStream: EventSource | null = null;
  let usageStream: EventSource | null = null;
  let notificationStream: EventSource | null = null;

  const loginForm = reactive({
    email: 'demo@agentforge.local',
    displayName: 'Demo User',
  });

  const projectForm = reactive({
    name: '',
    description: '',
    githubRepo: '',
    githubBranchPrefix: 'agentforge/',
  });

  const taskForm = reactive({
    title: '',
    description: '',
    assignedRoleId: '',
    priority: 2,
    modelOverride: '',
  });

  const roleForm = reactive({
    slug: '',
    displayName: '',
    modelPreference: 'openai:gpt-4.1-mini',
    systemPromptTemplate: '',
    toolAccessPolicy: 'file_system, code_execution, github_write',
  });

  const reviewForm = reactive({
    comment: '',
    targetRoleSlug: 'developer',
  });

  const roleTemplateState = reactive({
    exportText: '',
    importText: '',
    importMode: 'replace_existing' as 'merge' | 'replace_existing',
  });

  const notificationPreferences = reactive<NotificationPreferences>({
    emailNotificationsEnabled: false,
    webhookNotificationsEnabled: false,
    notificationEmail: null,
    notificationWebhookUrl: null,
  });

  const keyInputs = reactive({
    openai: '',
    anthropic: '',
  });

  const selectedProject = computed(
    () =>
      projects.value.find((project) => project.id === selectedProjectId.value) ??
      null,
  );

  const selectedTask = computed(
    () =>
      selectedProject.value?.tasks.find(
        (task) => task.id === selectedTaskId.value,
      ) ?? null,
  );

  const selectedRun = computed(() => selectedTask.value?.runs[0] ?? null);
  const unreadNotificationCount = computed(
    () => notifications.value.filter((notification) => !notification.readAt).length,
  );
  const showOnboarding = computed(
    () =>
      Boolean(session.value) &&
      !session.value?.onboardingCompleted &&
      projects.value.length === 0,
  );

  const visibleTasks = computed(() =>
    selectedProject.value
      ? [...selectedProject.value.tasks].sort((left, right) => {
          if (left.priority !== right.priority) {
            return left.priority - right.priority;
          }
          return left.title.localeCompare(right.title);
        })
      : [],
  );

  const projectCountLabel = computed(
    () => `${projects.value.length} project${projects.value.length === 1 ? '' : 's'}`,
  );

  function rememberToken(value: string) {
    token.value = value;
    if (import.meta.client) {
      localStorage.setItem('agent-forge-token', value);
    }
  }

  function closeStreams() {
    projectStream?.close();
    taskStream?.close();
    usageStream?.close();
    notificationStream?.close();
    projectStream = null;
    taskStream = null;
    usageStream = null;
    notificationStream = null;
  }

  function clearSession() {
    closeStreams();
    token.value = '';
    session.value = null;
    githubConfigured.value = false;
    projects.value = [];
    usage.value = null;
    notifications.value = [];
    roleTemplateLibrary.value = [];
    adminUsers.value = [];
    adminSystemStats.value = null;
    selectedProjectId.value = null;
    selectedTaskId.value = null;
    apiKeys.value = [];
    roleTemplateState.exportText = '';
    roleTemplateState.importText = '';
    reviewForm.comment = '';
    reviewForm.targetRoleSlug = 'developer';
    notificationPreferences.emailNotificationsEnabled = false;
    notificationPreferences.webhookNotificationsEnabled = false;
    notificationPreferences.notificationEmail = null;
    notificationPreferences.notificationWebhookUrl = null;
    if (import.meta.client) {
      localStorage.removeItem('agent-forge-token');
    }
  }

  async function apiFetch<T>(
    path: string,
    options: Record<string, unknown> = {},
  ) {
    const headers = {
      ...(options.headers as Record<string, string> | undefined),
      ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
    };

    return $fetch<T>(`${apiBase.value}${path}`, {
      ...options,
      headers,
    });
  }

  async function refreshProjects() {
    if (!token.value) {
      return;
    }

    const nextProjects = await apiFetch<ProjectRecord[]>('/projects');
    projects.value = nextProjects;
    if (!selectedProjectId.value && nextProjects[0]) {
      selectedProjectId.value = nextProjects[0].id;
    }
    if (
      selectedProjectId.value &&
      !nextProjects.some((project) => project.id === selectedProjectId.value)
    ) {
      selectedProjectId.value = nextProjects[0]?.id ?? null;
    }
    if (
      selectedTaskId.value &&
      !selectedProject.value?.tasks.some((task) => task.id === selectedTaskId.value)
    ) {
      selectedTaskId.value = selectedProject.value?.tasks[0]?.id ?? null;
    }
  }

  async function refreshApiKeys() {
    if (!token.value) {
      return;
    }

    apiKeys.value = await apiFetch<ApiKeyState[]>('/settings/api-keys');
  }

  async function refreshUsage() {
    if (!token.value) {
      return;
    }

    usage.value = await apiFetch<UsageSnapshot>('/subscriptions/me/usage');
  }

  async function refreshNotifications() {
    if (!token.value) {
      return;
    }

    notifications.value = await apiFetch<NotificationRecord[]>('/notifications');
  }

  async function refreshNotificationPreferences() {
    if (!token.value) {
      return;
    }

    Object.assign(
      notificationPreferences,
      await apiFetch<NotificationPreferences>('/notifications/preferences'),
    );
  }

  async function refreshRoleTemplateLibrary() {
    if (!token.value) {
      return;
    }

    roleTemplateLibrary.value = await apiFetch<RoleTemplateRecord[]>(
      '/role-templates/library',
    );
  }

  async function refreshAdminData() {
    if (!token.value || !session.value?.isAdmin) {
      return;
    }

    const [users, stats] = await Promise.all([
      apiFetch<AdminUserRecord[]>('/admin/users'),
      apiFetch<AdminSystemStats>('/admin/system/stats'),
    ]);
    adminUsers.value = users;
    adminSystemStats.value = stats;
  }

  async function refreshAll() {
    const work = [
      refreshProjects(),
      refreshApiKeys(),
      refreshUsage(),
      refreshNotifications(),
      refreshNotificationPreferences(),
      refreshRoleTemplateLibrary(),
    ];
    if (session.value?.isAdmin) {
      work.push(refreshAdminData());
    }
    await Promise.all(work);
  }

  async function initializeApp() {
    if (import.meta.client) {
      const storedToken = localStorage.getItem('agent-forge-token');
      if (storedToken) {
        token.value = storedToken;
      }
    }

    if (!token.value) {
      return;
    }

    try {
      const auth = await apiFetch<AuthResponse>('/auth/session');
      session.value = auth.user;
      githubConfigured.value = auth.githubConfigured;
      await refreshAll();
      syncStreams();
    } catch {
      clearSession();
    }
  }

  async function login() {
    loading.value = true;
    errorMessage.value = '';
    try {
      const auth = await apiFetch<AuthResponse>('/auth/dev-login', {
        method: 'POST',
        body: { ...loginForm },
      });
      rememberToken(auth.accessToken);
      session.value = auth.user;
      githubConfigured.value = auth.githubConfigured;
      actionMessage.value = 'Signed in with the local Phase 3 development flow.';
      await refreshAll();
      syncStreams();
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : 'Unable to sign in.';
    } finally {
      loading.value = false;
    }
  }

  async function createProject() {
    return mutate(async () => {
      await apiFetch('/projects', {
        method: 'POST',
        body: { ...projectForm },
      });
      if (session.value) {
        session.value.onboardingCompleted = true;
      }
      await Promise.all([refreshProjects(), refreshAdminData()]);
      actionMessage.value = `Created project "${projectForm.name}".`;
      resetProjectForm();
    }, 'Unable to create project.');
  }

  async function bootstrapSampleProject() {
    return mutate(async () => {
      await apiFetch('/projects/bootstrap-sample', {
        method: 'POST',
        body: {},
      });
      if (session.value) {
        session.value.onboardingCompleted = true;
      }
      await Promise.all([refreshProjects(), refreshUsage(), refreshAdminData()]);
      actionMessage.value =
        'Created the starter Phase 3 workspace with sample tasks and roles.';
    }, 'Unable to create the starter project.');
  }

  async function updateProject() {
    if (!selectedProject.value) {
      return;
    }

    return mutate(async () => {
      await apiFetch(`/projects/${selectedProject.value?.id}`, {
        method: 'PATCH',
        body: { ...projectForm },
      });
      await refreshProjects();
      actionMessage.value = `Updated project "${projectForm.name}".`;
    }, 'Unable to update project.');
  }

  async function deleteProject() {
    if (!selectedProject.value) {
      return;
    }

    return mutate(async () => {
      const deletedName = selectedProject.value?.name || 'project';
      await apiFetch(`/projects/${selectedProject.value?.id}`, {
        method: 'DELETE',
      });
      await Promise.all([refreshProjects(), refreshUsage(), refreshAdminData()]);
      actionMessage.value = `Deleted project "${deletedName}".`;
      resetProjectForm();
    }, 'Unable to delete project.');
  }

  async function createTask() {
    if (!selectedProject.value) {
      return;
    }

    return mutate(async () => {
      await apiFetch(`/projects/${selectedProject.value?.id}/tasks`, {
        method: 'POST',
        body: {
          ...taskForm,
          assignedRoleId: taskForm.assignedRoleId || undefined,
        },
      });
      await refreshProjects();
      actionMessage.value = `Created task "${taskForm.title}".`;
      resetTaskForm();
    }, 'Unable to create task.');
  }

  async function updateTask(taskId: string, payload: Record<string, unknown>) {
    return mutate(async () => {
      await apiFetch(`/tasks/${taskId}`, {
        method: 'PATCH',
        body: payload,
      });
      await Promise.all([refreshProjects(), refreshUsage(), refreshAdminData()]);
    }, 'Unable to update task.');
  }

  async function dispatchTask(taskId: string) {
    return runTaskAction(
      `/tasks/${taskId}/dispatch`,
      'The multi-agent workflow ran and the task is ready for review.',
      taskId,
    );
  }

  async function retryTask(taskId: string) {
    return runTaskAction(`/tasks/${taskId}/retry`, 'Retried the failed workflow.', taskId);
  }

  async function resumeTask(taskId: string) {
    return runTaskAction(
      `/tasks/${taskId}/resume`,
      'Resumed the blocked workflow.',
      taskId,
    );
  }

  async function submitReview(action: 'approve' | 'request_changes' | 'reject') {
    if (!selectedTask.value) {
      return;
    }

    return mutate(async () => {
      await apiFetch(`/tasks/${selectedTask.value?.id}/review`, {
        method: 'POST',
        body: {
          action,
          comment: reviewForm.comment || undefined,
          targetRoleSlug:
            action === 'request_changes'
              ? reviewForm.targetRoleSlug || undefined
              : undefined,
        },
      });
      await Promise.all([
        refreshProjects(),
        refreshUsage(),
        refreshNotifications(),
        refreshAdminData(),
      ]);
      actionMessage.value =
        action === 'approve'
          ? 'Approved the task and closed the review gate.'
          : action === 'reject'
            ? 'Rejected the task.'
            : 'Requested changes and resumed the agent workflow.';
      reviewForm.comment = '';
    }, 'Unable to submit the review.');
  }

  async function saveRole() { return mutate(async () => {
    if (!selectedProject.value) return;
    const payload = {
      ...roleForm,
      toolAccessPolicy: roleForm.toolAccessPolicy
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    };
    if (editingRoleId.value) {
      await apiFetch(`/roles/${editingRoleId.value}`, { method: 'PATCH', body: payload });
      actionMessage.value = `Updated role "${roleForm.displayName}".`;
    } else {
      await apiFetch(`/projects/${selectedProject.value.id}/roles`, { method: 'POST', body: payload });
      actionMessage.value = `Created role "${roleForm.displayName}".`;
    }
    await refreshProjects();
    openRoleEditor();
  }, 'Unable to save role.'); }

  async function removeRole(roleId: string) { return mutate(async () => {
    await apiFetch(`/roles/${roleId}`, { method: 'DELETE' });
    await refreshProjects();
    actionMessage.value = 'Deleted role.';
    if (editingRoleId.value === roleId) {
      openRoleEditor();
    }
  }, 'Unable to delete role.'); }

  async function exportRoleTemplates() {
    if (!selectedProject.value) return;
    const bundle = await apiFetch<RoleTemplateBundle>(`/projects/${selectedProject.value.id}/roles/export`);
    roleTemplateState.exportText = JSON.stringify(bundle, null, 2);
    actionMessage.value = `Exported ${bundle.roles.length} role templates.`;
  }

  async function importRoleTemplates() { return mutate(async () => {
    if (!selectedProject.value || !roleTemplateState.importText.trim()) return;
    const parsed = JSON.parse(roleTemplateState.importText) as { roles?: RoleTemplateRecord[]; mode?: 'merge' | 'replace_existing' } | RoleTemplateRecord[];
    const payload = Array.isArray(parsed)
      ? { roles: parsed, mode: roleTemplateState.importMode }
      : { roles: parsed.roles ?? [], mode: parsed.mode ?? roleTemplateState.importMode };
    await apiFetch(`/projects/${selectedProject.value.id}/roles/import`, { method: 'POST', body: payload });
    await refreshProjects();
    actionMessage.value = `Imported ${payload.roles.length} role templates.`;
  }, 'Unable to import role templates.'); }

  async function saveApiKey(provider: 'openai' | 'anthropic') { return mutate(async () => {
    if (!keyInputs[provider]) return;
    await apiFetch(`/settings/api-keys/${provider}`, { method: 'PUT', body: { apiKey: keyInputs[provider] } });
    keyInputs[provider] = '';
    await refreshApiKeys();
    actionMessage.value = `Stored ${provider} key.`;
  }, `Unable to store ${provider} key.`); }

  async function removeApiKey(provider: 'openai' | 'anthropic') { return mutate(async () => {
    await apiFetch(`/settings/api-keys/${provider}`, { method: 'DELETE' });
    await refreshApiKeys();
    actionMessage.value = `Removed ${provider} key.`;
  }, `Unable to remove ${provider} key.`); }

  async function saveNotificationPreferences() { return mutate(async () => {
    await apiFetch('/notifications/preferences', { method: 'PUT', body: { ...notificationPreferences } });
    await refreshNotificationPreferences();
    actionMessage.value = 'Saved notification preferences.';
  }, 'Unable to save notification preferences.'); }

  async function markNotificationRead(notificationId: string) {
    await apiFetch(`/notifications/${notificationId}/read`, { method: 'PATCH' });
    await refreshNotifications();
  }

  async function markAllNotificationsRead() {
    await apiFetch('/notifications/read-all', { method: 'POST' });
    await refreshNotifications();
  }

  async function updateAdminUser(userId: string, payload: Record<string, unknown>) { return mutate(async () => {
    await apiFetch(`/admin/users/${userId}`, { method: 'PATCH', body: payload });
    await refreshAdminData();
    actionMessage.value = 'Updated admin user settings.';
  }, 'Unable to update the user.'); }

  function openRoleEditor(role?: RoleRecord) {
    if (!role) {
      editingRoleId.value = null;
      roleForm.slug = '';
      roleForm.displayName = '';
      roleForm.modelPreference = 'openai:gpt-4.1-mini';
      roleForm.systemPromptTemplate = '';
      roleForm.toolAccessPolicy = 'file_system, code_execution, github_write';
      return;
    }
    editingRoleId.value = role.id;
    roleForm.slug = role.slug;
    roleForm.displayName = role.displayName;
    roleForm.modelPreference = role.modelPreference;
    roleForm.systemPromptTemplate = role.systemPromptTemplate;
    roleForm.toolAccessPolicy = role.toolAccessPolicy.join(', ');
  }

  function seedRoleImport(template: RoleTemplateRecord) {
    roleTemplateState.importText = JSON.stringify({ mode: roleTemplateState.importMode, roles: [template] }, null, 2);
  }

  function resetProjectForm() {
    projectForm.name = '';
    projectForm.description = '';
    projectForm.githubRepo = '';
    projectForm.githubBranchPrefix = 'agentforge/';
  }

  function fillProjectForm() {
    if (!selectedProject.value) return;
    projectForm.name = selectedProject.value.name;
    projectForm.description = selectedProject.value.description;
    projectForm.githubRepo = selectedProject.value.githubRepo ?? '';
    projectForm.githubBranchPrefix = selectedProject.value.githubBranchPrefix;
  }

  function resetTaskForm() {
    taskForm.title = '';
    taskForm.description = '';
    taskForm.assignedRoleId = selectedProject.value?.roles[0]?.id ?? '';
    taskForm.priority = 2;
    taskForm.modelOverride = '';
  }

  function tasksForStatus(status: string) {
    return visibleTasks.value.filter((task) => task.status === status);
  }

  function formatDate(value: string | null | undefined) {
    if (!value) return 'Never';
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function formatCurrency(value: number | null | undefined) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value ?? 0);
  }

  function beginDrag(taskId: string) { draggingTaskId.value = taskId; }

  async function handleDrop(status: string) {
    if (!draggingTaskId.value) return;
    const taskId = draggingTaskId.value;
    draggingTaskId.value = null;
    if (status === 'in_progress') {
      await dispatchTask(taskId);
      return;
    }
    await updateTask(taskId, { status });
  }

  function buildStreamUrl(path: string) {
    const url = new URL(`${apiBase.value}${path}`);
    url.searchParams.set('token', token.value);
    return url.toString();
  }

  function createEventSource(path: string, onEvent: () => void) {
    if (!import.meta.client || !token.value) return null;
    const source = new EventSource(buildStreamUrl(path));
    source.onmessage = () => onEvent();
    return source;
  }

  function syncStreams() {
    closeStreams();
    if (!token.value) return;
    usageStream = createEventSource('/events/usage', () => {
      refreshUsage();
      refreshAdminData();
    });
    notificationStream = createEventSource('/events/notifications', () => {
      refreshNotifications();
      refreshAdminData();
    });
    if (selectedProjectId.value) {
      projectStream = createEventSource(`/events/projects/${selectedProjectId.value}`, () => {
        refreshProjects();
        refreshAdminData();
      });
    }
    if (selectedTaskId.value) {
      taskStream = createEventSource(`/events/tasks/${selectedTaskId.value}`, () => {
        refreshProjects();
        refreshAdminData();
      });
    }
  }

  function setError(error: unknown, fallback: string) {
    errorMessage.value = error instanceof Error ? error.message : fallback;
  }

  async function mutate(run: () => Promise<void>, fallback: string) {
    loading.value = true;
    errorMessage.value = '';
    try {
      await run();
    } catch (error) {
      setError(error, fallback);
    } finally {
      loading.value = false;
    }
  }

  async function runTaskAction(path: string, successMessage: string, taskId: string) {
    return mutate(async () => {
      await apiFetch(path, { method: 'POST' });
      await Promise.all([
        refreshProjects(),
        refreshUsage(),
        refreshNotifications(),
        refreshAdminData(),
      ]);
      selectedTaskId.value = taskId;
      actionMessage.value = successMessage;
    }, 'Unable to update the task workflow.');
  }

  watch(selectedProjectId, () => {
    fillProjectForm();
    resetTaskForm();
    roleTemplateState.exportText = '';
    selectedTaskId.value = selectedProject.value?.tasks[0]?.id ?? null;
    syncStreams();
  });

  watch(selectedTaskId, () => {
    syncStreams();
  });

  watch(selectedProject, (project) => {
    if (!project) {
      openRoleEditor();
      return;
    }
    if (!project.roles.some((role) => role.id === editingRoleId.value)) {
      openRoleEditor(project.roles[0]);
    }
    const defaultRole =
      project.roles.find((role) => role.slug === 'developer')?.slug ??
      project.roles[0]?.slug ??
      'developer';
    if (!project.roles.some((role) => role.slug === reviewForm.targetRoleSlug)) {
      reviewForm.targetRoleSlug = defaultRole;
    }
  }, { immediate: true });

  watch(selectedTask, (task) => {
    if (!task) {
      reviewForm.comment = '';
      return;
    }
    reviewForm.targetRoleSlug =
      task.reviewRequestedRoleSlug ||
      reviewForm.targetRoleSlug ||
      selectedProject.value?.roles.find((role) => role.slug === 'developer')?.slug ||
      selectedProject.value?.roles[0]?.slug ||
      'developer';
  }, { immediate: true });

  onBeforeUnmount(() => {
    closeStreams();
  });

  return {
    actionMessage,
    adminSystemStats,
    adminUsers,
    apiKeys,
    beginDrag,
    bootstrapSampleProject,
    clearSession,
    createProject,
    createTask,
    deleteProject,
    dispatchTask,
    draggingTaskId,
    editingRoleId,
    errorMessage,
    exportRoleTemplates,
    formatCurrency,
    formatDate,
    githubConfigured,
    handleDrop,
    importRoleTemplates,
    initializeApp,
    keyInputs,
    loading,
    login,
    loginForm,
    markAllNotificationsRead,
    markNotificationRead,
    notificationPreferences,
    notifications,
    openRoleEditor,
    projectCountLabel,
    projectForm,
    projects,
    refreshAdminData,
    refreshNotifications,
    refreshProjects,
    refreshUsage,
    removeApiKey,
    removeRole,
    resetProjectForm,
    resumeTask,
    reviewForm,
    retryTask,
    roleForm,
    roleTemplateLibrary,
    roleTemplateState,
    saveApiKey,
    saveNotificationPreferences,
    saveRole,
    seedRoleImport,
    selectedProject,
    selectedProjectId,
    selectedRun,
    selectedTask,
    selectedTaskId,
    session,
    showOnboarding,
    submitReview,
    taskForm,
    tasksForStatus,
    token,
    unreadNotificationCount,
    updateAdminUser,
    updateProject,
    updateTask,
    usage,
    visibleTasks,
  };
};
