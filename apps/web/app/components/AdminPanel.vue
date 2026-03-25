<script setup lang="ts">
import type {
  AdminSystemStats,
  AdminUserRecord,
} from '../composables/agentforge.types';

defineProps<{
  formatCurrency: (value: number | null | undefined) => string;
  formatDate: (value: string | null | undefined) => string;
  loading: boolean;
  systemStats: AdminSystemStats | null;
  users: AdminUserRecord[];
}>();

defineEmits<{
  updateUser: [userId: string, payload: Record<string, unknown>];
}>();
</script>

<template>
  <section class="card">
    <div class="section-head">
      <div>
        <p class="eyebrow">Admin</p>
        <h2>Operations Desk</h2>
      </div>
    </div>

    <template v-if="systemStats">
      <div class="usage-grid">
        <article class="usage-stat">
          <span>Users</span>
          <strong>{{ systemStats.users }}</strong>
        </article>
        <article class="usage-stat">
          <span>Projects</span>
          <strong>{{ systemStats.projects }}</strong>
        </article>
        <article class="usage-stat">
          <span>Weekly Cost</span>
          <strong>{{ formatCurrency(systemStats.weeklyCostUsd) }}</strong>
        </article>
        <article class="usage-stat">
          <span>Queue</span>
          <strong>{{ systemStats.queue.mode }}</strong>
        </article>
      </div>

      <p class="hint">
        Queue: waiting {{ systemStats.queue.waiting }}, active {{ systemStats.queue.active }},
        failed {{ systemStats.queue.failed }}
      </p>

      <div class="stack compact">
        <div class="section-head compact-head">
          <strong>Dead Letter Queue</strong>
          <span>{{ systemStats.deadLetters.length }}</span>
        </div>
        <article v-for="task in systemStats.deadLetters" :key="task.id" class="stream-item">
          <div class="section-head compact-head">
            <strong>{{ task.title }}</strong>
            <span>{{ task.recoveryState }}</span>
          </div>
          <p class="hint">{{ task.lastFailureReason || 'No reason recorded.' }}</p>
          <p class="hint">{{ formatDate(task.deadLetteredAt || task.updatedAt) }}</p>
        </article>
      </div>

      <div class="stack compact">
        <div class="section-head compact-head">
          <strong>Users</strong>
          <span>{{ users.length }}</span>
        </div>
        <article v-for="user in users" :key="user.id" class="stream-item">
          <div class="section-head compact-head">
            <strong>{{ user.displayName }}</strong>
            <span>{{ user.email }}</span>
          </div>
          <div class="inline-fields admin-grid">
            <label>
              Tier
              <select
                :value="user.subscriptionTier"
                @change="
                  $emit('updateUser', user.id, {
                    subscriptionTier: ($event.target as HTMLSelectElement).value,
                  })
                "
              >
                <option value="free">free</option>
                <option value="pro">pro</option>
                <option value="team">team</option>
              </select>
            </label>
            <label>
              Status
              <select
                :value="user.subscriptionStatus"
                @change="
                  $emit('updateUser', user.id, {
                    subscriptionStatus: ($event.target as HTMLSelectElement).value,
                  })
                "
              >
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="cancelled">cancelled</option>
              </select>
            </label>
            <label>
              Sessions
              <input
                :value="user.maxConcurrentSessions"
                type="number"
                min="1"
                @change="
                  $emit('updateUser', user.id, {
                    maxConcurrentSessions: Number(
                      ($event.target as HTMLInputElement).value,
                    ),
                  })
                "
              />
            </label>
          </div>
          <div class="inline-fields admin-grid">
            <label>
              Weekly tasks
              <input
                :value="user.maxWeeklyTasks"
                type="number"
                min="1"
                @change="
                  $emit('updateUser', user.id, {
                    maxWeeklyTasks: Number(
                      ($event.target as HTMLInputElement).value,
                    ),
                  })
                "
              />
            </label>
            <label>
              Admin
              <select
                :value="String(user.isAdmin)"
                @change="
                  $emit('updateUser', user.id, {
                    isAdmin:
                      ($event.target as HTMLSelectElement).value === 'true',
                  })
                "
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
            <div class="hint">
              {{ user.projectCount }} projects, {{ user.deadLetterTasks }} dead letters,
              {{ formatCurrency(user.weeklyCostUsd) }} this week
            </div>
          </div>
        </article>
      </div>
    </template>

    <p v-else class="hint">Admin data becomes available after sign-in.</p>
  </section>
</template>
