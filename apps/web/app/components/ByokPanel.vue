<script setup lang="ts">
import type { ApiKeyState } from '../composables/useAgentForge';

defineProps<{
  apiKeys: ApiKeyState[];
  formatDate: (value: string | null | undefined) => string;
  keyInputs: {
    openai: string;
    anthropic: string;
  };
  loading: boolean;
}>();

defineEmits<{
  removeKey: [provider: 'openai' | 'anthropic'];
  saveKey: [provider: 'openai' | 'anthropic'];
}>();
</script>

<template>
  <section class="card">
    <div class="section-head">
      <div>
        <p class="eyebrow">Keys</p>
        <h2>BYOK Controls</h2>
      </div>
    </div>

    <div v-for="provider in apiKeys" :key="provider.provider" class="provider-card">
      <div class="provider-head">
        <strong>{{ provider.provider }}</strong>
        <span>{{ provider.configured ? 'configured' : 'not set' }}</span>
      </div>
      <p>Updated: {{ formatDate(provider.updatedAt) }}</p>
      <div class="inline-fields key-grid">
        <input
          v-model="keyInputs[provider.provider]"
          type="password"
          :placeholder="`Paste ${provider.provider} key`"
        />
        <button class="primary-button" :disabled="loading" @click="$emit('saveKey', provider.provider)">
          Save
        </button>
        <button
          class="ghost-button"
          :disabled="loading || !provider.configured"
          @click="$emit('removeKey', provider.provider)"
        >
          Remove
        </button>
      </div>
    </div>
  </section>
</template>
