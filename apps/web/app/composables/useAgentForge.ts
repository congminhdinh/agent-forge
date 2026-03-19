export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  authProvider: string;
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

export type AgentRun = {
  id: string;
  status: string;
  provider: string;
  model: string;
  prompt: string;
  rawOutput: string;
  summary: string | null;
  filesChanged: string[];
  error: string | null;
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
  runs: AgentRun[];
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

export const boardColumns = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'needs_review', label: 'Needs Review' },
  { key: 'changes_requested', label: 'Changes' },
  { key: 'done', label: 'Done' },
  { key: 'failed', label: 'Failed' },
];

export const useAgentForge = () => {
  const config = useRuntimeConfig();
  const apiBase = computed(
    () => config.public.apiBaseUrl || 'http://localhost:3001',
  );

  const token = ref('');
  const session = ref<AuthUser | null>(null);
  const githubConfigured = ref(false);
  const apiKeys = ref<ApiKeyState[]>([]);
  const projects = ref<ProjectRecord[]>([]);
  const selectedProjectId = ref<string | null>(null);
  const selectedTaskId = ref<string | null>(null);
  const editingRoleId = ref<string | null>(null);
  const loading = ref(false);
  const actionMessage = ref('');
  const errorMessage = ref('');
  const draggingTaskId = ref<string | null>(null);

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
    toolAccessPolicy: 'file_system',
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

  function clearSession() {
    token.value = '';
    session.value = null;
    githubConfigured.value = false;
    projects.value = [];
    selectedProjectId.value = null;
    selectedTaskId.value = null;
    apiKeys.value = [];
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
      await Promise.all([refreshProjects(), refreshApiKeys()]);
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
      actionMessage.value = 'Signed in with the local Phase 1 development flow.';
      await Promise.all([refreshProjects(), refreshApiKeys()]);
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : 'Unable to sign in.';
    } finally {
      loading.value = false;
    }
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

  function resetProjectForm() {
    projectForm.name = '';
    projectForm.description = '';
    projectForm.githubRepo = '';
    projectForm.githubBranchPrefix = 'agentforge/';
  }

  function fillProjectForm() {
    if (!selectedProject.value) {
      return;
    }

    projectForm.name = selectedProject.value.name;
    projectForm.description = selectedProject.value.description;
    projectForm.githubRepo = selectedProject.value.githubRepo ?? '';
    projectForm.githubBranchPrefix = selectedProject.value.githubBranchPrefix;
  }

  async function createProject() {
    loading.value = true;
    errorMessage.value = '';
    try {
      await apiFetch('/projects', {
        method: 'POST',
        body: { ...projectForm },
      });
      await refreshProjects();
      actionMessage.value = `Created project "${projectForm.name}".`;
      resetProjectForm();
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : 'Unable to create project.';
    } finally {
      loading.value = false;
    }
  }

  async function updateProject() {
    if (!selectedProject.value) {
      return;
    }

    loading.value = true;
    errorMessage.value = '';
    try {
      await apiFetch(`/projects/${selectedProject.value.id}`, {
        method: 'PATCH',
        body: { ...projectForm },
      });
      await refreshProjects();
      actionMessage.value = `Updated project "${projectForm.name}".`;
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : 'Unable to update project.';
    } finally {
      loading.value = false;
    }
  }

  async function deleteProject() {
    if (!selectedProject.value) {
      return;
    }

    loading.value = true;
    errorMessage.value = '';
    try {
      const deletedName = selectedProject.value.name;
      await apiFetch(`/projects/${selectedProject.value.id}`, {
        method: 'DELETE',
      });
      await refreshProjects();
      actionMessage.value = `Deleted project "${deletedName}".`;
      resetProjectForm();
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : 'Unable to delete project.';
    } finally {
      loading.value = false;
    }
  }

  function resetTaskForm() {
    taskForm.title = '';
    taskForm.description = '';
    taskForm.assignedRoleId = selectedProject.value?.roles[0]?.id ?? '';
    taskForm.priority = 2;
    taskForm.modelOverride = '';
  }

  async function createTask() {
    if (!selectedProject.value) {
      return;
    }

    loading.value = true;
    errorMessage.value = '';
    try {
      await apiFetch(`/projects/${selectedProject.value.id}/tasks`, {
        method: 'POST',
        body: {
          ...taskForm,
          assignedRoleId: taskForm.assignedRoleId || undefined,
        },
      });
      await refreshProjects();
      actionMessage.value = `Created task "${taskForm.title}".`;
      resetTaskForm();
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : 'Unable to create task.';
    } finally {
      loading.value = false;
    }
  }

  async function updateTask(taskId: string, payload: Record<string, unknown>) {
    loading.value = true;
    errorMessage.value = '';
    try {
      await apiFetch(`/tasks/${taskId}`, {
        method: 'PATCH',
        body: payload,
      });
      await refreshProjects();
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : 'Unable to update task.';
    } finally {
      loading.value = false;
    }
  }

  async function dispatchTask(taskId: string) {
    loading.value = true;
    errorMessage.value = '';
    try {
      await apiFetch(`/tasks/${taskId}/dispatch`, {
        method: 'POST',
      });
      await refreshProjects();
      selectedTaskId.value = taskId;
      actionMessage.value =
        'Single-agent dispatch finished and the latest output is ready to review.';
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : 'Unable to dispatch task.';
    } finally {
      loading.value = false;
    }
  }

  function openRoleEditor(role?: RoleRecord) {
    if (!role) {
      editingRoleId.value = null;
      roleForm.slug = '';
      roleForm.displayName = '';
      roleForm.modelPreference = 'openai:gpt-4.1-mini';
      roleForm.systemPromptTemplate = '';
      roleForm.toolAccessPolicy = 'file_system';
      return;
    }

    editingRoleId.value = role.id;
    roleForm.slug = role.slug;
    roleForm.displayName = role.displayName;
    roleForm.modelPreference = role.modelPreference;
    roleForm.systemPromptTemplate = role.systemPromptTemplate;
    roleForm.toolAccessPolicy = role.toolAccessPolicy.join(', ');
  }

  async function saveRole() {
    if (!selectedProject.value) {
      return;
    }

    const payload = {
      ...roleForm,
      toolAccessPolicy: roleForm.toolAccessPolicy
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    };

    loading.value = true;
    errorMessage.value = '';
    try {
      if (editingRoleId.value) {
        await apiFetch(`/roles/${editingRoleId.value}`, {
          method: 'PATCH',
          body: payload,
        });
        actionMessage.value = `Updated role "${roleForm.displayName}".`;
      } else {
        await apiFetch(`/projects/${selectedProject.value.id}/roles`, {
          method: 'POST',
          body: payload,
        });
        actionMessage.value = `Created role "${roleForm.displayName}".`;
      }

      await refreshProjects();
      openRoleEditor();
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : 'Unable to save role.';
    } finally {
      loading.value = false;
    }
  }

  async function removeRole(roleId: string) {
    loading.value = true;
    errorMessage.value = '';
    try {
      await apiFetch(`/roles/${roleId}`, {
        method: 'DELETE',
      });
      await refreshProjects();
      actionMessage.value = 'Deleted role.';
      if (editingRoleId.value === roleId) {
        openRoleEditor();
      }
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : 'Unable to delete role.';
    } finally {
      loading.value = false;
    }
  }

  async function saveApiKey(provider: 'openai' | 'anthropic') {
    if (!keyInputs[provider]) {
      return;
    }

    loading.value = true;
    errorMessage.value = '';
    try {
      await apiFetch(`/settings/api-keys/${provider}`, {
        method: 'PUT',
        body: { apiKey: keyInputs[provider] },
      });
      keyInputs[provider] = '';
      await refreshApiKeys();
      actionMessage.value = `Stored ${provider} key.`;
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : `Unable to store ${provider} key.`;
    } finally {
      loading.value = false;
    }
  }

  async function removeApiKey(provider: 'openai' | 'anthropic') {
    loading.value = true;
    errorMessage.value = '';
    try {
      await apiFetch(`/settings/api-keys/${provider}`, {
        method: 'DELETE',
      });
      await refreshApiKeys();
      actionMessage.value = `Removed ${provider} key.`;
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : `Unable to remove ${provider} key.`;
    } finally {
      loading.value = false;
    }
  }

  function tasksForStatus(status: string) {
    return visibleTasks.value.filter((task) => task.status === status);
  }

  function formatDate(value: string | null | undefined) {
    if (!value) {
      return 'Never';
    }

    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  function beginDrag(taskId: string) {
    draggingTaskId.value = taskId;
  }

  async function handleDrop(status: string) {
    if (!draggingTaskId.value) {
      return;
    }

    const taskId = draggingTaskId.value;
    draggingTaskId.value = null;
    await updateTask(taskId, { status });
  }

  watch(selectedProjectId, () => {
    fillProjectForm();
    resetTaskForm();
    selectedTaskId.value = selectedProject.value?.tasks[0]?.id ?? null;
  });

  watch(
    selectedProject,
    (project) => {
      if (!project) {
        openRoleEditor();
        return;
      }
      if (!project.roles.some((role) => role.id === editingRoleId.value)) {
        openRoleEditor(project.roles[0]);
      }
    },
    { immediate: true },
  );

  return {
    actionMessage,
    apiKeys,
    beginDrag,
    clearSession,
    createProject,
    createTask,
    deleteProject,
    dispatchTask,
    draggingTaskId,
    editingRoleId,
    errorMessage,
    formatDate,
    githubConfigured,
    handleDrop,
    initializeApp,
    keyInputs,
    loading,
    login,
    loginForm,
    openRoleEditor,
    projectCountLabel,
    projectForm,
    projects,
    refreshProjects,
    removeApiKey,
    removeRole,
    resetProjectForm,
    roleForm,
    saveApiKey,
    saveRole,
    selectedProject,
    selectedProjectId,
    selectedRun,
    selectedTask,
    selectedTaskId,
    session,
    taskForm,
    tasksForStatus,
    token,
    updateProject,
    updateTask,
    visibleTasks,
  };
};
