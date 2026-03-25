<script setup lang="ts">
import type {
  NotificationPreferences,
  NotificationRecord,
} from '../composables/agentforge.types';

defineProps<{
  formatDate: (value: string | null | undefined) => string;
  loading: boolean;
  notificationPreferences: NotificationPreferences;
  notifications: NotificationRecord[];
  unreadNotificationCount: number;
}>();

defineEmits<{
  markAllRead: [];
  markRead: [notificationId: string];
  savePreferences: [];
}>();
</script>

<template>
  <section class="card">
    <div class="section-head">
      <div>
        <p class="eyebrow">Notifications</p>
        <h2>Alerts</h2>
      </div>
      <button
        class="ghost-button small"
        :disabled="loading || unreadNotificationCount === 0"
        @click="$emit('markAllRead')"
      >
        Mark All Read
      </button>
    </div>

    <div class="stack compact">
      <label>
        <span>Email notifications</span>
        <input
          v-model="notificationPreferences.emailNotificationsEnabled"
          type="checkbox"
        />
      </label>
      <label>
        Notification email
        <input
          v-model="notificationPreferences.notificationEmail"
          type="email"
          placeholder="ops@example.com"
        />
      </label>
      <label>
        <span>Webhook notifications</span>
        <input
          v-model="notificationPreferences.webhookNotificationsEnabled"
          type="checkbox"
        />
      </label>
      <label>
        Webhook URL
        <input
          v-model="notificationPreferences.notificationWebhookUrl"
          type="url"
          placeholder="https://example.com/hooks/agentforge"
        />
      </label>
    </div>

    <button class="primary-button" :disabled="loading" @click="$emit('savePreferences')">
      Save Preferences
    </button>

    <div class="stack compact">
      <div class="section-head compact-head">
        <strong>Recent Notifications</strong>
        <span>{{ unreadNotificationCount }} unread</span>
      </div>
      <article
        v-for="notification in notifications"
        :key="notification.id"
        class="stream-item"
        :class="{ unread: !notification.readAt }"
      >
        <div class="section-head compact-head">
          <strong>{{ notification.title }}</strong>
          <span>{{ notification.channel }} / {{ notification.status }}</span>
        </div>
        <p class="hint">{{ notification.message }}</p>
        <p class="hint">
          {{ formatDate(notification.createdAt) }}
          <span v-if="notification.error">- {{ notification.error }}</span>
        </p>
        <button
          class="ghost-button small"
          :disabled="loading || Boolean(notification.readAt)"
          @click="$emit('markRead', notification.id)"
        >
          Mark Read
        </button>
      </article>
    </div>
  </section>
</template>
