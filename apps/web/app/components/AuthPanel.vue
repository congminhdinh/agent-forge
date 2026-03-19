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
      <p class="eyebrow">AgentForge Phase 1</p>
      <h1>Shape work into a board, hand it to an agent, and keep the output reviewable.</h1>
      <p class="hero-copy">
        This MVP runs with a local development sign-in, project CRUD, role
        configuration, task dispatch, BYOK model routing, and an output viewer
        ready for review.
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
