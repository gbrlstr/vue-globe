<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { GlobeView } from '@/engine/view'
import {
  resolveConfig,
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
    config?: Partial<GlobeConfig>
    assets?: GlobeAssets
  }>(),
  {
    regions: () => [],
    markers: () => [],
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

function sync() {
  view?.setOptions({
    regions: props.regions,
    markers: props.markers,
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
watch(
  () => props.regions,
  () => sync(),
  { deep: true },
)
watch(
  () => props.markers,
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
