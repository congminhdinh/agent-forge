<script setup lang="ts">
import type { ProjectRecord } from '../composables/agentforge.types';

defineProps<{
  editingRoleId: string | null;
  loading: boolean;
  project: ProjectRecord | null;
  roleForm: {
    slug: string;
    displayName: string;
    modelPreference: string;
    systemPromptTemplate: string;
    toolAccessPolicy: string;
  };
}>();

defineEmits<{
  deleteRole: [roleId: string];
  editRole: [roleId?: string];
  saveRole: [];
}>();
</script>

<template>
  <section class="card">
    <div class="section-head">
      <div>
        <p class="eyebrow">Roles</p>
        <h2>Role Studio</h2>
      </div>
      <button class="ghost-button small" @click="$emit('editRole')">New</button>
    </div>

    <div class="role-pills">
      <button
        v-for="role in project?.roles || []"
        :key="role.id"
        class="project-pill"
        :class="{ active: editingRoleId === role.id }"
        @click="$emit('editRole', role.id)"
      >
        <strong>{{ role.displayName }}</strong>
        <span>{{ role.modelPreference }}</span>
      </button>
    </div>

    <div class="stack">
      <label>
        Slug
        <input v-model="roleForm.slug" type="text" placeholder="security-auditor" />
      </label>
      <label>
        Display name
        <input v-model="roleForm.displayName" type="text" placeholder="Security Auditor" />
      </label>
      <label>
        Model preference
        <input
          v-model="roleForm.modelPreference"
          type="text"
          placeholder="openai:gpt-4.1-mini"
        />
      </label>
      <label>
        Tool policy
        <input
          v-model="roleForm.toolAccessPolicy"
          type="text"
          placeholder="file_system, code_execution"
        />
      </label>
      <label>
        Prompt template
        <textarea
          v-model="roleForm.systemPromptTemplate"
          rows="8"
          placeholder="Role system prompt"
        />
      </label>
    </div>

    <div class="button-row">
      <button
        class="primary-button"
        :disabled="loading || !project"
        @click="$emit('saveRole')"
      >
        {{ editingRoleId ? 'Update Role' : 'Create Role' }}
      </button>
      <button
        class="danger-button"
        :disabled="loading || !editingRoleId"
        @click="$emit('deleteRole', editingRoleId!)"
      >
        Delete
      </button>
    </div>
  </section>
</template>
