<script setup lang="ts">
import type { UsageSnapshot } from '../composables/useAgentForge';

defineProps<{
  formatDate: (value: string | null | undefined) => string;
  usage: UsageSnapshot | null;
}>();
</script>

<template>
  <section class="card">
    <div class="section-head">
      <div>
        <p class="eyebrow">Usage</p>
        <h2>Quota Dashboard</h2>
      </div>
    </div>

    <template v-if="usage">
      <div class="usage-grid">
        <article class="usage-stat">
          <span>Sessions</span>
          <strong>{{ usage.sessions.active }} / {{ usage.sessions.limit }}</strong>
        </article>
        <article class="usage-stat">
          <span>Weekly Tasks</span>
          <strong>{{ usage.weekly_tasks.used }} / {{ usage.weekly_tasks.limit }}</strong>
        </article>
      </div>

      <p class="hint">
        {{ usage.tier }} tier Â· resets {{ formatDate(usage.weekly_tasks.resetsAt) }}
      </p>

      <div class="stack compact">
        <div class="section-head compact-head">
          <strong>Recent Sessions</strong>
          <span>{{ usage.recent_sessions.length }}</span>
        </div>
        <div v-for="session in usage.recent_sessions" :key="session.taskId + session.createdAt" class="stream-item">
          <div class="section-head compact-head">
            <strong>{{ session.taskTitle }}</strong>
            <span>{{ session.role }}</span>
          </div>
          <p class="hint">{{ session.model }} Â· {{ session.status }}</p>
          <p class="hint">{{ session.summary || 'No summary available.' }}</p>
          <p class="hint">
            {{ formatDate(session.createdAt) }}
            <span v-if="session.durationSec">Â· {{ session.durationSec }}s</span>
          </p>
        </div>
      </div>
    </template>

    <p v-else class="hint">
      Sign in and dispatch a task to populate live quota usage.
    </p>
  </section>
</template>