<script setup lang="ts">
import type { RoleTemplateRecord } from '../composables/agentforge.types';

defineProps<{
  library: RoleTemplateRecord[];
  loading: boolean;
  roleTemplateState: {
    exportText: string;
    importText: string;
    importMode: 'merge' | 'replace_existing';
  };
}>();

defineEmits<{
  exportTemplates: [];
  importTemplates: [];
  seedImport: [template: RoleTemplateRecord];
}>();
</script>

<template>
  <section class="card">
    <div class="section-head">
      <div>
        <p class="eyebrow">Marketplace</p>
        <h2>Role Templates</h2>
      </div>
      <button class="ghost-button small" :disabled="loading" @click="$emit('exportTemplates')">
        Export Project
      </button>
    </div>

    <div class="stack compact">
      <article
        v-for="template in library"
        :key="template.slug"
        class="stream-item"
      >
        <div class="section-head compact-head">
          <strong>{{ template.displayName }}</strong>
          <span>{{ template.category }}</span>
        </div>
        <p class="hint">{{ template.summary }}</p>
        <button class="ghost-button small" @click="$emit('seedImport', template)">
          Stage Import
        </button>
      </article>
    </div>

    <label>
      Import mode
      <select v-model="roleTemplateState.importMode">
        <option value="replace_existing">Replace existing slugs</option>
        <option value="merge">Keep existing slugs</option>
      </select>
    </label>

    <label>
      Import JSON
      <textarea
        v-model="roleTemplateState.importText"
        rows="7"
        placeholder='{"mode":"replace_existing","roles":[...]}'
      />
    </label>

    <label>
      Export JSON
      <textarea
        v-model="roleTemplateState.exportText"
        rows="7"
        placeholder="Exported role templates will appear here"
      />
    </label>

    <button class="primary-button" :disabled="loading" @click="$emit('importTemplates')">
      Import Templates
    </button>
  </section>
</template>
