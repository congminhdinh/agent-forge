<script setup lang="ts">
defineProps<{
  loading: boolean;
  errorMessage: string;
  loginForm: {
    email: string;
    displayName: string;
  };
}>();

defineEmits<{
  login: [];
}>();
</script>

<template>
  <main class="auth-shell">
    <section class="hero-panel">
      <p class="eyebrow">AgentForge Phase 3</p>
      <h1>Operate the workflow, recover failures, and keep cost, review, and admin controls in one place.</h1>
      <p class="hero-copy">
        This workspace now adds onboarding, notifications, recovery actions,
        role-template import or export, admin quota controls, and cost telemetry on top
        of the existing multi-agent review flow.
      </p>
    </section>

    <section class="login-panel">
      <h2>Development Login</h2>
      <label>
        Email
        <input v-model="loginForm.email" type="email" placeholder="demo@agentforge.local" />
      </label>
      <label>
        Display name
        <input v-model="loginForm.displayName" type="text" placeholder="Demo User" />
      </label>
      <button class="primary-button" :disabled="loading" @click="$emit('login')">
        {{ loading ? 'Signing in...' : 'Enter Workspace' }}
      </button>
      <p class="hint">
        GitHub OAuth route is available when server credentials are configured.
      </p>
      <p v-if="errorMessage" class="feedback error">{{ errorMessage }}</p>
    </section>
  </main>
</template>
