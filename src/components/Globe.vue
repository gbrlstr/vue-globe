<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRaw, watch } from 'vue'

import { GlobeView } from '@/engine/view'
import {
  resolveConfig,
  type GlobeArc,
  type GlobeAssets,
  type GlobeConfig,
  type GlobeMarker,
  type Region,
  type RegionPointerEvent,
} from '@/types'

const props = withDefaults(
  defineProps<{
    regions?: Region[]
    markers?: GlobeMarker[]
    arcs?: GlobeArc[]
    config?: Partial<GlobeConfig>
    assets?: GlobeAssets
  }>(),
  {
    regions: () => [],
    markers: () => [],
    arcs: () => [],
    config: () => ({}),
  },
)

const emit = defineEmits<{
  ready: []
  regionHover: [event: RegionPointerEvent | null]
  regionClick: [event: RegionPointerEvent]
  pointerMiss: []
  markerHover: [marker: GlobeMarker | null]
  markerClick: [marker: GlobeMarker]
}>()

const rootRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const resolved = computed(() => resolveConfig(props.config))

let view: GlobeView | undefined

// Lê as coordenadas pelo objeto original: passar por um proxy reativo deixa o desenho e o hover muito mais lentos.
function plainRegions() {
  return toRaw(props.regions).map((region) => ({ ...toRaw(region), geometry: toRaw(region.geometry) }))
}

function sync() {
  view?.setOptions({
    regions: plainRegions(),
    markers: toRaw(props.markers),
    arcs: toRaw(props.arcs),
    config: resolved.value,
  })
}

function focus(id: string) {
  view?.focus(id)
}

function highlight(id: string | null) {
  view?.highlight(id)
}

function clear() {
  view?.clear()
}

defineExpose({ focus, highlight, clear, canvasRef })

onMounted(() => {
  if (!canvasRef.value || !rootRef.value) return
  view = new GlobeView(
    canvasRef.value,
    rootRef.value,
    {
      onHover: (region) => emit('regionHover', region),
      onClick: (region) => emit('regionClick', region),
      onMiss: () => emit('pointerMiss'),
      onReady: () => emit('ready'),
      onMarkerHover: (marker) => emit('markerHover', marker),
      onMarkerClick: (marker) => emit('markerClick', marker),
    },
    props.assets,
  )
  sync()
})

onUnmounted(() => {
  view?.destroy()
  view = undefined
})

watch(
  () => props.config,
  () => sync(),
  { deep: true },
)
// Só id, cores e trava importam para redesenhar. Um watch profundo percorreria todas as coordenadas a cada mudança.
watch(
  () => [props.regions, props.regions.map((r) => `${r.id}|${r.fill ?? ''}|${r.border ?? ''}|${r.locked ? 1 : 0}`).join(',')],
  () => sync(),
)
watch(
  () => props.markers,
  () => sync(),
  { deep: true },
)
watch(
  () => props.arcs,
  () => sync(),
  { deep: true },
)
</script>

<template>
  <div ref="rootRef" class="vue-globe" :style="{ background: resolved.colors.background }">
    <canvas ref="canvasRef" />
  </div>
</template>

<style scoped>
.vue-globe {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100%;
  overflow: hidden;
  cursor: grab;
}

.vue-globe canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
