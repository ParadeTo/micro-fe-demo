<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtWelcome />
    <div id="banners"></div>
    <div id="taskList"></div>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig();

useMicroFrontend({
  name: 'banners',
  entry: `${config.public.microAppsBase}/banners/index.html`,
  container: '#banners',
});

useMicroFrontend({
  name: 'task-list',
  entry: `${config.public.microAppsBase}/task-list/index.html`,
  container: '#taskList',
  props: {
    apiBaseUrl: config.public.apiBase,
  },
});
</script>
