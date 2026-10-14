<script setup lang="ts">
import { reactive, ref } from 'vue'

import Globe from '@/components/Globe.vue'
import { defaultConfig, type RegionPointerEvent } from '@/types'

const hovered = ref('nenhuma')
const selected = ref<RegionPointerEvent | null>(null)
const config = reactive(structuredClone(defaultConfig))

function onHover(event: RegionPointerEvent | null) {
  hovered.value = event?.region.name ?? 'nenhuma'
}

function onClick(event: RegionPointerEvent) {
  selected.value = event
}

</script>

<template>
  <main>
    <Globe :config="config" @region-hover="onHover" @region-click="onClick" @pointer-miss="selected = null" />

    <aside>
      <h1>vue-globe</h1>
      <p>{{ hovered }}</p>
      <p v-if="selected" class="picked">
        clique: {{ selected.region.name }}
        <span>{{ selected.lat.toFixed(1) }}, {{ selected.lng.toFixed(1) }}</span>
      </p>

      <label><input v-model="config.showLines" type="checkbox" /> Linhas</label>
      <label><input v-model="config.showGrid" type="checkbox" /> Grade</label>
      <label><input v-model="config.showAtmosphere" type="checkbox" /> Atmosfera</label>
      <label><input v-model="config.showClouds" type="checkbox" /> Nuvens</label>
      <label><input v-model="config.showCells" type="checkbox" /> Células</label>
      <label><input v-model="config.autoRotate" type="checkbox" /> Rotação</label>
      <label><input v-model="config.interactive" type="checkbox" /> Interação</label>

      <label class="range">
        Velocidade
        <input v-model.number="config.rotateSpeed" type="range" min="0" max="0.8" step="0.01" />
      </label>
      <label class="range">
        Opacidade das linhas
        <input v-model.number="config.lineOpacity" type="range" min="0.05" max="1" step="0.05" />
      </label>
      <label class="range">
        Distância
        <input v-model.number="config.camera.distance" type="range" min="3.2" max="8" step="0.05" />
      </label>

      <div class="colors">
        <label>Borda <input v-model="config.colors.border" type="color" /></label>
        <label>Preenchimento <input v-model="config.colors.fill" type="color" /></label>
        <label>Hover <input v-model="config.colors.hover" type="color" /></label>
        <label>Oceano <input v-model="config.colors.ocean" type="color" /></label>
        <label>Terra <input v-model="config.colors.land" type="color" /></label>
        <label>Grade <input v-model="config.colors.grid" type="color" /></label>
        <label>Atmosfera <input v-model="config.colors.atmosphere" type="color" /></label>
        <label>Fundo <input v-model="config.colors.background" type="color" /></label>
      </div>
    </aside>
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

aside {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2;
  width: 220px;
  max-height: calc(100vh - 32px);
  overflow: auto;
  padding: 14px;
  border: 1px solid rgba(206, 223, 243, 0.18);
  border-radius: 12px;
  background: rgba(6, 16, 24, 0.88);
  color: #d7e4f2;
  font: 13px/1.4 ui-sans-serif, system-ui, sans-serif;
}

h1 {
  margin: 0 0 4px;
  font-size: 14px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

aside p {
  margin: 0 0 12px;
  color: #8fb4d9;
}

.picked span {
  display: block;
  color: #d7e4f2;
}

label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 6px 0;
}

.range {
  display: block;
  margin-top: 12px;
}

.range input,
.colors input {
  width: 100%;
}

.colors {
  display: grid;
  gap: 6px;
  margin-top: 12px;
}

.colors label input {
  width: 42px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
}
</style>
