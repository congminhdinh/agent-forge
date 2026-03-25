<script setup lang="ts">
import type {
  ProjectRecord,
  TaskRecord,
} from '../composables/agentforge.types';

defineProps<{
  formatCurrency: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
  loading: boolean;
  project: ProjectRecord | null;
  reviewForm: {
    comment: string;
    targetRoleSlug: string;
  };
  selectedTask: TaskRecord | null;
}>();

defineEmits<{
  resumeTask: [taskId: string];
  retryTask: [taskId: string];
  submitReview: [action: 'approve' | 'request_changes' | 'reject'];
  updateTask: [taskId: string, payload: Record<string, unknown>];
}>();
</script>

<template>
  <section class="card output-card">
    <div class="section-head">
      <div>
        <p class="eyebrow">Review</p>
        <h2>{{ selectedTask?.title || 'Select a task' }}</h2>
      </div>
      <span v-if="selectedTask" class="status-pill">{{ selectedTask.status }}</span>
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

        <p class="hint">
          {{ selectedTask.latestSummary || selectedTask.description || 'No summary yet.' }}
        </p>
      </div>

      <div class="provider-card">
        <div class="provider-head">
          <strong>GitHub handoff</strong>
          <span>{{ selectedTask.github.status || 'not configured' }}</span>
        </div>
        <p>{{ selectedTask.github.statusReason || 'No GitHub metadata is available yet.' }}</p>
        <p v-if="selectedTask.github.branch" class="mono">{{ selectedTask.github.branch }}</p>
        <p v-if="selectedTask.github.prUrl">
          <a :href="selectedTask.github.prUrl" target="_blank" rel="noreferrer">
            Open compare link
          </a>
        </p>
      </div>

      <div class="run-meta">
        <span>Latest provider: {{ selectedTask.runs[0]?.provider || 'none' }}</span>
        <span>Model: {{ selectedTask.runs[0]?.model || 'none' }}</span>
        <span>Sandbox: {{ selectedTask.runs[0]?.sandboxStatus || 'n/a' }}</span>
        <span>Tokens: {{ selectedTask.runs[0]?.totalTokens || 0 }}</span>
        <span>Cost: {{ formatCurrency(selectedTask.runs[0]?.costUsd || 0) }}</span>
        <span>Updated: {{ formatDate(selectedTask.runs[0]?.createdAt) }}</span>
      </div>

      <div class="provider-card">
        <div class="provider-head">
          <strong>Recovery</strong>
          <span>{{ selectedTask.recovery.state }}</span>
        </div>
        <p>
          Retries {{ selectedTask.recovery.retryCount }} / {{ selectedTask.recovery.maxRetries }}
        </p>
        <p>{{ selectedTask.recovery.lastFailureReason || 'No failure reason recorded.' }}</p>
        <p v-if="selectedTask.recovery.deadLetteredAt" class="hint">
          Dead-lettered {{ formatDate(selectedTask.recovery.deadLetteredAt) }}
        </p>
        <div class="button-row">
          <button
            class="ghost-button"
            :disabled="loading || selectedTask.status !== 'blocked'"
            @click="$emit('resumeTask', selectedTask.id)"
          >
            Resume
          </button>
          <button
            class="danger-button"
            :disabled="loading || selectedTask.status !== 'failed'"
            @click="$emit('retryTask', selectedTask.id)"
          >
            Retry
          </button>
        </div>
      </div>

      <div v-if="selectedTask.status === 'needs_review'" class="provider-card">
        <div class="provider-head">
          <strong>Human review gate</strong>
          <span>Required</span>
        </div>

        <label>
          Review comment
          <textarea
            v-model="reviewForm.comment"
            rows="3"
            placeholder="Call out approval notes or requested changes"
          />
        </label>

        <label>
          Request changes target
          <select v-model="reviewForm.targetRoleSlug">
            <option
              v-for="role in project?.roles || []"
              :key="role.slug"
              :value="role.slug"
            >
              {{ role.displayName }}
            </option>
          </select>
        </label>

        <div class="button-row review-actions">
          <button class="primary-button" :disabled="loading" @click="$emit('submitReview', 'approve')">
            Approve
          </button>
          <button class="ghost-button" :disabled="loading" @click="$emit('submitReview', 'request_changes')">
            Request Changes
          </button>
          <button class="danger-button" :disabled="loading" @click="$emit('submitReview', 'reject')">
            Reject
          </button>
        </div>
      </div>

      <div class="stack compact">
        <div class="section-head compact-head">
          <strong>Agent messages</strong>
          <span>{{ selectedTask.messages.length }}</span>
        </div>
        <div v-if="selectedTask.messages.length" class="stack compact">
          <article v-for="message in selectedTask.messages" :key="message.id" class="stream-item">
            <div class="section-head compact-head">
              <strong>{{ message.from_role }}</strong>
              <span>{{ message.message_type }}</span>
            </div>
            <p class="hint">{{ message.output }}</p>
            <p class="hint">
              Next: {{ message.to_role || 'human review' }}
              <span v-if="message.next_action"> - {{ message.next_action }}</span>
            </p>
            <p class="hint">{{ formatDate(message.createdAt) }}</p>
          </article>
        </div>
        <p v-else class="hint">Dispatch a task to capture inter-agent handoffs.</p>
      </div>

      <div class="stack compact">
        <div class="section-head compact-head">
          <strong>Review history</strong>
          <span>{{ selectedTask.reviews.length }}</span>
        </div>
        <div v-if="selectedTask.reviews.length" class="stack compact">
          <article v-for="review in selectedTask.reviews" :key="review.id" class="stream-item">
            <div class="section-head compact-head">
              <strong>{{ review.reviewer.displayName }}</strong>
              <span>{{ review.action }}</span>
            </div>
            <p class="hint">{{ review.comment || 'No comment attached.' }}</p>
            <p v-if="review.diffSnapshot" class="mono">{{ review.diffSnapshot }}</p>
            <p class="hint">{{ formatDate(review.createdAt) }}</p>
          </article>
        </div>
        <p v-else class="hint">No human review decisions yet.</p>
      </div>

      <div class="stack compact">
        <div class="section-head compact-head">
          <strong>Timeline</strong>
          <span>{{ selectedTask.transitions.length }}</span>
        </div>
        <div v-if="selectedTask.transitions.length" class="stack compact">
          <article v-for="transition in selectedTask.transitions" :key="transition.id" class="stream-item">
            <div class="section-head compact-head">
              <strong>{{ transition.fromStatus || 'none' }} -> {{ transition.toStatus }}</strong>
              <span>{{ transition.triggeredBy }}</span>
            </div>
            <p class="hint">{{ transition.reason || 'No reason logged.' }}</p>
            <p class="hint">{{ formatDate(transition.createdAt) }}</p>
          </article>
        </div>
      </div>

      <pre class="output-panel">{{
        selectedTask.runs[0]?.rawOutput || 'Dispatch a task to capture output.'
      }}</pre>
    </template>
    <p v-else class="hint">
      Select a task card to inspect its agent messages, review state, and run output.
    </p>
  </section>
</template>
