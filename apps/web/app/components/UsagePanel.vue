<script setup lang="ts">
import type { UsageSnapshot } from '../composables/agentforge.types';

defineProps<{
  formatCurrency: (value: number | null | undefined) => string;
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
        <article class="usage-stat">
          <span>Weekly Cost</span>
          <strong>{{ formatCurrency(usage.weekly_cost_usd) }}</strong>
        </article>
        <article class="usage-stat">
          <span>Weekly Tokens</span>
          <strong>{{ usage.weekly_tokens }}</strong>
        </article>
      </div>

      <p class="hint">
        {{ usage.tier }} tier - resets {{ formatDate(usage.weekly_tasks.resetsAt) }}
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
          <p class="hint">{{ session.model }} - {{ session.status }}</p>
          <p class="hint">{{ session.summary || 'No summary available.' }}</p>
          <p class="hint">
            Tokens {{ session.totalTokens }} -
            {{ formatCurrency(session.costUsd) }} ({{ session.costSource }})
          </p>
          <p class="hint">
            {{ formatDate(session.createdAt) }}
            <span v-if="session.durationSec">- {{ session.durationSec }}s</span>
          </p>
        </div>
      </div>
    </template>

    <p v-else class="hint">
      Sign in and dispatch a task to populate live quota usage.
    </p>
  </section>
</template>
