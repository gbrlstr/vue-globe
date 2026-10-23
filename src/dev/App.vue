<script setup lang="ts">
import { reactive, ref } from 'vue'

import Globe from '@/components/Globe.vue'
import { defaultConfig, type GlobeAssets, type GlobeMarker, type RegionPointerEvent } from '@/types'
import colorMapUrl from '@/assets/textures/color_map.webp?url'
import seaMapUrl from '@/assets/textures/sea_map.webp?url'
import specularMapUrl from '@/assets/textures/specular_map.webp?url'
import bumpMapUrl from '@/assets/textures/bump_map.webp?url'
import normalMapUrl from '@/assets/textures/normal_map.webp?url'
import worldUrl from '@/assets/data/world-main.json?url'

// No build da biblioteca os arquivos vão para dist/assets; no dev o Vite serve direto de src/assets.
const assets: GlobeAssets = {
  world: worldUrl,
  textures: { color: colorMapUrl, sea: seaMapUrl, specular: specularMapUrl, bump: bumpMapUrl, normal: normalMapUrl },
}

const hovered = ref('nenhuma')
const selected = ref<RegionPointerEvent | null>(null)
const config = reactive(structuredClone(defaultConfig))

function onHover(event: RegionPointerEvent | null) {
  hovered.value = event?.region.name ?? 'nenhuma'
}

function onClick(event: RegionPointerEvent) {
  selected.value = event
}

const markers: GlobeMarker[] = [
  { id: 'fortaleza', lat: -3.73, lng: -38.52, label: 'Fortaleza' },
  { id: 'sao-paulo', lat: -23.55, lng: -46.63, label: 'São Paulo' },
  { id: 'lisboa', lat: 38.72, lng: -9.14, label: 'Lisboa' },
  { id: 'nova-york', lat: 40.71, lng: -74.0, label: 'Nova York', color: '#4ade80' },
  { id: 'cidade-do-cabo', lat: -33.92, lng: 18.42, label: 'Cidade do Cabo' },
  { id: 'toquio', lat: 35.68, lng: 139.69, label: 'Tóquio' },
  { id: 'sydney', lat: -33.87, lng: 151.21, label: 'Sydney' },
]
const globe = ref<InstanceType<typeof Globe> | null>(null)
const markerHovered = ref('nenhum')
const markerClicked = ref<GlobeMarker | null>(null)

function onMarkerHover(marker: GlobeMarker | null) {
  markerHovered.value = marker?.label ?? 'nenhum'
}

function onMarkerClick(marker: GlobeMarker) {
  markerClicked.value = marker
}

</script>

<template>
  <main>
    <Globe
      ref="globe"
      :config="config"
      :assets="assets"
      :markers="markers"
      @region-hover="onHover"
      @region-click="onClick"
      @pointer-miss="selected = null"
      @marker-hover="onMarkerHover"
      @marker-click="onMarkerClick"
    />

    <aside>
      <h1>vue-globe</h1>
      <p>{{ hovered }}</p>
      <p v-if="selected" class="picked">
        clique: {{ selected.region.name }}
        <span>{{ selected.lat.toFixed(1) }}, {{ selected.lng.toFixed(1) }}</span>
      </p>
      <p>marcador: {{ markerHovered }}</p>
      <p v-if="markerClicked" class="picked">clique no marcador: {{ markerClicked.label }}</p>

      <div class="actions">
        <button type="button" @click="globe?.focus('toquio')">Ir para Tóquio</button>
        <button type="button" @click="globe?.highlight('JPN')">Destacar Japão</button>
        <button type="button" @click="globe?.clear()">Limpar</button>
      </div>

      <label><input v-model="config.showLines" type="checkbox" /> Linhas</label>
      <label><input v-model="config.showGrid" type="checkbox" /> Grade</label>
      <label><input v-model="config.showAtmosphere" type="checkbox" /> Atmosfera</label>
      <label><input v-model="config.showClouds" type="checkbox" /> Nuvens</label>
      <label><input v-model="config.showCells" type="checkbox" /> Células</label>
      <label><input v-model="config.autoRotate" type="checkbox" /> Rotação</label>
      <label><input v-model="config.interactive" type="checkbox" /> Interação</label>
      <label><input v-model="config.showMarkers" type="checkbox" /> Marcadores</label>
      <label>
        Rótulos
        <select v-model="config.markerLabels">
          <option value="always">sempre</option>
          <option value="hover">no hover</option>
          <option value="never">nunca</option>
        </select>
      </label>
      <label class="range">
        Tamanho dos marcadores
        <input v-model.number="config.markerSize" type="range" min="0.02" max="0.12" step="0.005" />
      </label>

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
        <label>Marcador <input v-model="config.colors.marker" type="color" /></label>
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

.actions {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
}

.actions button {
  padding: 6px 8px;
  border: 1px solid rgba(206, 223, 243, 0.25);
  border-radius: 8px;
  background: rgba(206, 223, 243, 0.08);
  color: inherit;
  font: inherit;
  cursor: pointer;
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
