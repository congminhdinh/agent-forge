<script setup lang="ts">
import { boardColumns, type ProjectRecord, type TaskRecord } from '../composables/useAgentForge';

defineProps<{
  formatDate: (value: string | null | undefined) => string;
  project: ProjectRecord | null;
  selectedTask: TaskRecord | null;
}>();

defineEmits<{
  updateTask: [taskId: string, payload: Record<string, unknown>];
}>();
</script>

<template>
  <section class="card output-card">
    <div class="section-head">
      <div>
        <p class="eyebrow">Output</p>
        <h2>{{ selectedTask?.title || 'Select a task' }}</h2>
      </div>
    </div>

    <template v-if="selectedTask">
      <div class="stack compact">
        <label>
          Assigned role
          <select
            :value="selectedTask.assignedRole?.id || ''"
            @change="
              $emit('updateTask', selectedTask.id, {
                assignedRoleId: ($event.target as HTMLSelectElement).value || null,
              })
            "
          >
            <option value="">Unassigned</option>
            <option v-for="role in project?.roles || []" :key="role.id" :value="role.id">
              {{ role.displayName }}
            </option>
          </select>
        </label>
        <label>
          Status
          <select
            :value="selectedTask.status"
            @change="
              $emit('updateTask', selectedTask.id, {
                status: ($event.target as HTMLSelectElement).value,
              })
            "
          >
            <option v-for="column in boardColumns" :key="column.key" :value="column.key">
              {{ column.label }}
            </option>
          </select>
        </label>
      </div>

      <div class="run-meta">
        <span>Latest provider: {{ selectedTask.runs[0]?.provider || 'none' }}</span>
        <span>Model: {{ selectedTask.runs[0]?.model || 'none' }}</span>
        <span>Updated: {{ formatDate(selectedTask.runs[0]?.createdAt) }}</span>
      </div>

      <pre class="output-panel">{{
        selectedTask.runs[0]?.rawOutput || 'Dispatch a task to capture output.'
      }}</pre>
    </template>
    <p v-else class="hint">
      Select a task card to inspect its prompt, output, and current assignment.
    </p>
  </section>
</template>
