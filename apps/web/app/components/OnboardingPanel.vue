<script setup lang="ts">
import type { RoleTemplateRecord } from '../composables/agentforge.types';

defineProps<{
  library: RoleTemplateRecord[];
  loading: boolean;
}>();

defineEmits<{
  bootstrap: [];
}>();
</script>

<template>
  <section class="card">
    <div class="section-head">
      <div>
        <p class="eyebrow">Onboarding</p>
        <h2>Launch The Starter Workspace</h2>
      </div>
    </div>

    <p class="hint">
      Phase 3 adds an onboarding path for first-time operators. Start with a seeded
      project, three sample tasks, and a starter role library that shows how the
      workflow is expected to run.
    </p>

    <div class="stack compact">
      <article
        v-for="template in library.slice(0, 3)"
        :key="template.slug"
        class="stream-item"
      >
        <div class="section-head compact-head">
          <strong>{{ template.displayName }}</strong>
          <span>{{ template.category }}</span>
        </div>
        <p class="hint">{{ template.summary }}</p>
      </article>
    </div>

    <button class="primary-button" :disabled="loading" @click="$emit('bootstrap')">
      Create Starter Project
    </button>
  </section>
</template>
