<script setup lang="ts">
import { ref } from 'vue'

import Globe from '@/components/Globe.vue'
import type { Region } from '@/types'

const hovered = ref('nenhuma')

function onHover(region: Region | null) {
  hovered.value = region?.name ?? 'nenhuma'
}
</script>

<template>
  <main>
    <Globe @region-hover="onHover" @region-click="onHover" @pointer-miss="onHover(null)" />
    <p class="status">região: {{ hovered }}</p>
  </main>
</template>

<style>
html,
body,
#app {
  margin: 0;
  width: 100%;
  height: 100%;
  background: #061018;
}

main {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100dvh;
}

.status {
  position: fixed;
  left: 16px;
  bottom: 16px;
  margin: 0;
  color: #d7e4f2;
  font: 14px/1.4 ui-sans-serif, system-ui, sans-serif;
}
</style>
