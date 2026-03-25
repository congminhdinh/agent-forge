<script setup lang="ts">
import { boardColumns, type ProjectRecord, type TaskRecord } from '../composables/useAgentForge';

defineProps<{
  loading: boolean;
  project: ProjectRecord | null;
  selectedTaskId: string | null;
  taskForm: {
    title: string;
    description: string;
    assignedRoleId: string;
    priority: number;
    modelOverride: string;
  };
  tasksForStatus: (status: string) => TaskRecord[];
}>();

defineEmits<{
  createTask: [];
  dispatchTask: [taskId: string];
  dragStart: [taskId: string];
  dropStatus: [status: string];
  selectTask: [taskId: string];
}>();
</script>

<template>
  <section class="board card">
    <div class="section-head">
      <div>
        <p class="eyebrow">Board</p>
        <h2>{{ project?.name || 'Create a project to begin' }}</h2>
      </div>
      <span class="board-note">Move a task into In Progress to dispatch the multi-agent workflow.</span>
    </div>

    <div class="task-form stack">
      <label>
        Task title
        <input v-model="taskForm.title" type="text" placeholder="Implement auth flow" />
      </label>
      <label>
        Description
        <textarea
          v-model="taskForm.description"
          rows="3"
          placeholder="Describe the task outcome"
        />
      </label>
      <div class="inline-fields">
        <label>
          Assigned role
          <select v-model="taskForm.assignedRoleId">
            <option value="">Unassigned</option>
            <option v-for="role in project?.roles || []" :key="role.id" :value="role.id">
              {{ role.displayName }}
            </option>
          </select>
        </label>
        <label>
          Priority
          <input v-model.number="taskForm.priority" type="number" min="0" max="9" />
        </label>
        <label>
          Model override
          <input
            v-model="taskForm.modelOverride"
            type="text"
            placeholder="openai:gpt-4.1-mini"
          />
        </label>
      </div>
      <button
        class="primary-button"
        :disabled="loading || !project"
        @click="$emit('createTask')"
      >
        Create Task
      </button>
    </div>

    <div v-if="project" class="board-grid">
      <div
        v-for="column in boardColumns"
        :key="column.key"
        class="kanban-column"
        @dragover.prevent
        @drop="$emit('dropStatus', column.key)"
      >
        <div class="column-head">
          <h3>{{ column.label }}</h3>
          <span>{{ tasksForStatus(column.key).length }}</span>
        </div>
        <button
          v-for="task in tasksForStatus(column.key)"
          :key="task.id"
          class="task-card"
          :class="{ active: selectedTaskId === task.id }"
          draggable="true"
          @dragstart="$emit('dragStart', task.id)"
          @click="$emit('selectTask', task.id)"
        >
          <div class="task-topline">
            <span class="priority-chip">P{{ task.priority }}</span>
            <span>{{ task.assignedRole?.displayName || 'No role' }}</span>
          </div>
          <strong>{{ task.title }}</strong>
          <p>{{ task.latestSummary || task.description || 'No summary yet.' }}</p>
          <div class="task-actions">
            <span>{{ task.messages.length }} messages Â· {{ task.reviews.length }} reviews</span>
            <button class="ghost-button small" @click.stop="$emit('dispatchTask', task.id)">
              Dispatch
            </button>
          </div>
        </button>
      </div>
    </div>
  </section>
</template>