<script setup lang="ts">
import type { ProjectRecord } from '../composables/agentforge.types';

defineProps<{
  loading: boolean;
  selectedProject: ProjectRecord | null;
  selectedProjectId: string | null;
  projectForm: {
    name: string;
    description: string;
    githubRepo: string;
    githubBranchPrefix: string;
  };
  projects: ProjectRecord[];
}>();

defineEmits<{
  create: [];
  delete: [];
  reset: [];
  select: [projectId: string];
  update: [];
}>();
</script>

<template>
  <aside class="sidebar card">
    <div class="section-head">
      <div>
        <p class="eyebrow">Projects</p>
        <h2>Project Control</h2>
      </div>
      <button class="ghost-button small" @click="$emit('reset')">Reset</button>
    </div>

    <div class="project-list">
      <button
        v-for="project in projects"
        :key="project.id"
        class="project-pill"
        :class="{ active: selectedProjectId === project.id }"
        @click="$emit('select', project.id)"
      >
        <strong>{{ project.name }}</strong>
        <span>{{ project.tasks.length }} tasks</span>
      </button>
    </div>

    <div class="stack">
      <label>
        Name
        <input v-model="projectForm.name" type="text" placeholder="Agent platform" />
      </label>
      <label>
        Description
        <textarea
          v-model="projectForm.description"
          rows="3"
          placeholder="Short project brief"
        />
      </label>
      <label>
        GitHub repo
        <input v-model="projectForm.githubRepo" type="text" placeholder="owner/repo" />
      </label>
      <label>
        Branch prefix
        <input
          v-model="projectForm.githubBranchPrefix"
          type="text"
          placeholder="agentforge/"
        />
      </label>
    </div>

    <div class="button-row">
      <button class="primary-button" :disabled="loading" @click="$emit('create')">
        Create
      </button>
      <button
        class="ghost-button"
        :disabled="loading || !selectedProject"
        @click="$emit('update')"
      >
        Update
      </button>
      <button
        class="danger-button"
        :disabled="loading || !selectedProject"
        @click="$emit('delete')"
      >
        Delete
      </button>
    </div>
  </aside>
</template>
