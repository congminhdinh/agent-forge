<script setup lang="ts">
import AuthPanel from './components/AuthPanel.vue';
import ByokPanel from './components/ByokPanel.vue';
import KanbanBoard from './components/KanbanBoard.vue';
import ProjectSidebar from './components/ProjectSidebar.vue';
import RoleStudio from './components/RoleStudio.vue';
import TaskOutputViewer from './components/TaskOutputViewer.vue';
import { useAgentForge } from './composables/useAgentForge';

const app = useAgentForge();

onMounted(() => {
  app.initializeApp();
});

useSeoMeta({
  title: 'AgentForge Phase 1',
  description:
    'Project CRUD, kanban orchestration, single-agent dispatch, and BYOK management.',
});
</script>

<template>
  <div class="shell">
    <div class="backdrop backdrop-left" />
    <div class="backdrop backdrop-right" />

    <AuthPanel
      v-if="!app.session"
      :error-message="app.errorMessage"
      :loading="app.loading"
      :login-form="app.loginForm"
      @login="app.login"
    />

    <main v-else class="workspace-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">AgentForge</p>
          <h1>Phase 1 MVP Workspace</h1>
        </div>
        <div class="topbar-meta">
          <p>{{ app.session.displayName }} · {{ app.projectCountLabel }}</p>
          <p>GitHub OAuth {{ app.githubConfigured ? 'ready' : 'not configured' }}</p>
        </div>
        <button class="ghost-button" @click="app.clearSession">Sign out</button>
      </header>

      <p v-if="app.actionMessage" class="feedback success">{{ app.actionMessage }}</p>
      <p v-if="app.errorMessage" class="feedback error">{{ app.errorMessage }}</p>

      <section class="workspace-grid">
        <ProjectSidebar
          :loading="app.loading"
          :project-form="app.projectForm"
          :projects="app.projects"
          :selected-project="app.selectedProject"
          :selected-project-id="app.selectedProjectId"
          @create="app.createProject"
          @delete="app.deleteProject"
          @reset="app.resetProjectForm"
          @select="app.selectedProjectId = $event"
          @update="app.updateProject"
        />

        <KanbanBoard
          :loading="app.loading"
          :project="app.selectedProject"
          :selected-task-id="app.selectedTaskId"
          :task-form="app.taskForm"
          :tasks-for-status="app.tasksForStatus"
          @create-task="app.createTask"
          @dispatch-task="app.dispatchTask"
          @drag-start="app.beginDrag"
          @drop-status="app.handleDrop"
          @select-task="app.selectedTaskId = $event"
        />

        <aside class="details-column">
          <RoleStudio
            :editing-role-id="app.editingRoleId"
            :loading="app.loading"
            :project="app.selectedProject"
            :role-form="app.roleForm"
            @delete-role="app.removeRole"
            @edit-role="
              app.openRoleEditor(
                app.selectedProject?.roles.find((role) => role.id === $event),
              )
            "
            @save-role="app.saveRole"
          />

          <ByokPanel
            :api-keys="app.apiKeys"
            :format-date="app.formatDate"
            :key-inputs="app.keyInputs"
            :loading="app.loading"
            @remove-key="app.removeApiKey"
            @save-key="app.saveApiKey"
          />

          <TaskOutputViewer
            :format-date="app.formatDate"
            :project="app.selectedProject"
            :selected-task="app.selectedTask"
            @update-task="app.updateTask"
          />
        </aside>
      </section>
    </main>
  </div>
</template>

<style scoped>
:global(body) {
  margin: 0;
  font-family: "Avenir Next", "Segoe UI", sans-serif;
  background:
    radial-gradient(circle at top left, rgba(255, 186, 73, 0.24), transparent 24%),
    radial-gradient(circle at bottom right, rgba(255, 107, 53, 0.16), transparent 28%),
    linear-gradient(135deg, #08121e, #142538 52%, #0b1019 100%);
  color: #f7f3ec;
}

:global(*) {
  box-sizing: border-box;
}

:global(button) {
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition:
    transform 160ms ease,
    opacity 160ms ease,
    background 160ms ease;
}

:global(button:hover:not(:disabled)) {
  transform: translateY(-1px);
}

:global(button:disabled) {
  opacity: 0.55;
  cursor: not-allowed;
}

:global(input),
:global(textarea),
:global(select) {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.06);
  color: #f7f3ec;
  border-radius: 0.9rem;
  padding: 0.85rem 0.95rem;
  outline: none;
}

:global(textarea) {
  resize: vertical;
}

:global(input:focus),
:global(textarea:focus),
:global(select:focus) {
  border-color: rgba(255, 184, 77, 0.72);
  box-shadow: 0 0 0 3px rgba(255, 184, 77, 0.15);
}

:global(label) {
  display: grid;
  gap: 0.45rem;
  font-size: 0.92rem;
  color: rgba(247, 243, 236, 0.9);
}

:global(.hero-panel),
:global(.login-panel),
:global(.card) {
  background: rgba(10, 18, 29, 0.72);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 1.5rem;
  box-shadow: 0 28px 70px rgba(0, 0, 0, 0.22);
  padding: 1.5rem;
}

:global(.eyebrow) {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.75rem;
  color: #ffb84d;
}

:global(.hero-panel h1),
:global(.topbar h1) {
  font-family: "Trebuchet MS", "Avenir Next Condensed", sans-serif;
  letter-spacing: 0.02em;
  line-height: 1.02;
  margin: 0.4rem 0 0.8rem;
}

:global(.hero-panel h1) {
  font-size: clamp(2.7rem, 5vw, 4.8rem);
  max-width: 12ch;
}

:global(.hero-copy),
:global(.hint),
:global(.board-note),
:global(.task-card p),
:global(.provider-card p) {
  color: rgba(247, 243, 236, 0.76);
}

:global(.section-head),
:global(.column-head),
:global(.provider-head),
:global(.task-topline),
:global(.task-actions),
:global(.button-row),
:global(.inline-fields) {
  display: flex;
  gap: 0.75rem;
}

:global(.section-head),
:global(.column-head),
:global(.provider-head),
:global(.task-topline),
:global(.task-actions),
:global(.button-row) {
  justify-content: space-between;
  align-items: center;
}

:global(.stack) {
  display: grid;
  gap: 0.85rem;
}

:global(.stack.compact) {
  gap: 0.6rem;
}

:global(.inline-fields) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

:global(.primary-button),
:global(.ghost-button),
:global(.danger-button) {
  padding: 0.85rem 1.15rem;
  font-weight: 700;
}

:global(.primary-button) {
  background: linear-gradient(135deg, #ffb84d, #ff6b35);
  color: #07111d;
}

:global(.ghost-button) {
  background: rgba(255, 255, 255, 0.08);
  color: #f7f3ec;
}

:global(.danger-button) {
  background: rgba(255, 107, 107, 0.18);
  color: #ffbdbd;
}

:global(.ghost-button.small) {
  padding: 0.45rem 0.8rem;
  font-size: 0.82rem;
}

:global(.feedback) {
  margin: 0 0 1rem;
  padding: 0.8rem 1rem;
  border-radius: 1rem;
}

:global(.feedback.success) {
  background: rgba(95, 213, 122, 0.14);
  color: #bbf7c5;
}

:global(.feedback.error) {
  background: rgba(255, 107, 107, 0.16);
  color: #ffc0c0;
}

:global(.project-list),
:global(.role-pills) {
  display: grid;
  gap: 0.7rem;
  margin-bottom: 1rem;
}

:global(.project-pill) {
  text-align: left;
  padding: 0.85rem 0.95rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 1rem;
  border: 1px solid transparent;
  color: inherit;
}

:global(.project-pill strong),
:global(.project-pill span) {
  display: block;
}

:global(.project-pill span) {
  color: rgba(247, 243, 236, 0.68);
  font-size: 0.85rem;
}

:global(.project-pill.active) {
  border-color: rgba(255, 184, 77, 0.48);
  background: rgba(255, 184, 77, 0.08);
}

:global(.board-grid) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.9rem;
  margin-top: 1.2rem;
}

:global(.kanban-column) {
  min-height: 18rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 1.2rem;
  padding: 0.9rem;
  display: grid;
  align-content: start;
  gap: 0.8rem;
}

:global(.task-card) {
  text-align: left;
  width: 100%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(8, 18, 30, 0.9));
  color: inherit;
  border-radius: 1rem;
  padding: 0.9rem;
  border: 1px solid transparent;
  display: grid;
  gap: 0.65rem;
}

:global(.task-card.active) {
  border-color: rgba(88, 179, 255, 0.55);
}

:global(.priority-chip) {
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  background: rgba(255, 184, 77, 0.18);
  color: #ffd58f;
}

:global(.task-actions) {
  font-size: 0.82rem;
  color: rgba(247, 243, 236, 0.7);
}

:global(.provider-card) {
  display: grid;
  gap: 0.5rem;
  padding: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 1rem;
  margin-top: 0.8rem;
}

:global(.run-meta) {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  margin: 1rem 0;
  color: rgba(247, 243, 236, 0.72);
  font-size: 0.86rem;
}

:global(.output-panel) {
  max-height: 24rem;
  overflow: auto;
  padding: 1rem;
  border-radius: 1rem;
  background: rgba(0, 0, 0, 0.28);
  color: #f4ead7;
  white-space: pre-wrap;
  margin: 0;
}

.shell {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

.backdrop {
  position: absolute;
  border-radius: 999px;
  filter: blur(80px);
  opacity: 0.4;
}

.backdrop-left {
  width: 28rem;
  height: 28rem;
  left: -10rem;
  top: 8rem;
  background: rgba(255, 157, 76, 0.35);
}

.backdrop-right {
  width: 24rem;
  height: 24rem;
  right: -8rem;
  bottom: 2rem;
  background: rgba(88, 179, 255, 0.24);
}

.workspace-shell {
  position: relative;
  z-index: 1;
  max-width: 1480px;
  margin: 0 auto;
  padding: 2rem;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.topbar-meta {
  text-align: right;
  color: rgba(247, 243, 236, 0.76);
}

.topbar-meta p {
  margin: 0.1rem 0;
}

.workspace-grid {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 380px;
  gap: 1rem;
  align-items: start;
}

.details-column {
  display: grid;
  gap: 1rem;
}

:global(.auth-shell) {
  position: relative;
  z-index: 1;
  max-width: 1480px;
  margin: 0 auto;
  padding: 2rem;
  min-height: 100vh;
  display: grid;
  align-items: center;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 1.5rem;
}

@media (max-width: 1180px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }

  .board-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .topbar-meta {
    text-align: left;
  }

  :global(.inline-fields),
  :global(.board-grid),
  :global(.auth-shell) {
    grid-template-columns: 1fr;
  }

  .workspace-shell {
    padding: 1rem;
  }
}
</style>
