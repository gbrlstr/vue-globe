import { countryName } from './countries'
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  FrontSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  PerspectiveCamera,
  Raycaster,
  Scene,
  ShaderMaterial,
  Sphere,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'

import {
  defaultConfig,
  type GlobeArc,
  type FocusOptions,
  type GlobeAssets,
  type GlobeConfig,
  type GlobeMarker,
  type GlobeTextureUrls,
  type Region,
  type RegionPointerEvent,
} from '@/types'

import {
  buildRings,
  buildSphere,
  FILL_TEX_H,
  FILL_TEX_W,
  findFeatureAtLatLng,
  indexWorld,
  mergePolylines,
  paintGeometry,
  type CountryLines,
  type IndexedFeature,
} from './borders'
import { ArcLayer } from './arcs'
import { findRegion, GLOBE_RADIUS, latLngToSphere, sphereToLatLng } from './geo'
import { createFillSphereMaterial, createGlobeMaterial } from './globeShader.js'
import { HeatMap } from './heatmap'
import { MarkerLayer } from './markers'

// No build (vite.config.ts), cada marcador vira `new URL("./assets/...", import.meta.url).href`
// e o arquivo é copiado para dist/assets, em vez de ser embutido no JavaScript da biblioteca.
// Fora do build (ex.: `npm run dev`) o marcador fica como está: passe `assets` ao componente.
const defaultWorldUrl = '__VUE_GLOBE_ASSET__data/world-main.json'
const defaultTextureUrls: GlobeTextureUrls = {
  color: '__VUE_GLOBE_ASSET__textures/color_map.webp',
  sea: '__VUE_GLOBE_ASSET__textures/sea_map.webp',
  specular: '__VUE_GLOBE_ASSET__textures/specular_map.webp',
  bump: '__VUE_GLOBE_ASSET__textures/bump_map.webp',
  normal: '__VUE_GLOBE_ASSET__textures/normal_map.webp',
}

// As camadas de hover e seleção são repintadas a cada mudança de região e enviadas inteiras à GPU.
// Em metade da resolução o envio custa um quarto, e a borda do país continua nítida por causa da linha.
const HIGHLIGHT_TEXTURE_SCALE = 0.5
// A resolução cai, no máximo até aqui, quando a placa de vídeo não dá conta de 60 quadros por segundo.
const MIN_PIXEL_RATIO = 0.75

const DEFAULT_FLIGHT_MS = 900

interface Flight {
  from: { yaw: number; pitch: number; distance: number }
  to: { yaw: number; pitch: number; distance: number }
  start: number
  duration: number
}

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export interface GlobeViewOptions {
  regions: Region[]
  markers: GlobeMarker[]
  arcs: GlobeArc[]
  config: GlobeConfig
}

export interface GlobeViewHandlers {
  onHover: (event: RegionPointerEvent | null) => void
  onClick: (event: RegionPointerEvent) => void
  onMiss: () => void
  onReady: () => void
  onMarkerHover: (marker: GlobeMarker | null) => void
  onMarkerClick: (marker: GlobeMarker) => void
}

export class GlobeView {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera: PerspectiveCamera
  private readonly raycaster = new Raycaster()
  private readonly pointer = new Vector2(-2, -2)
  private readonly resizeObserver: ResizeObserver
  private readonly loader = new TextureLoader()
  private readonly markerLayer: MarkerLayer
  private readonly arcLayer: ArcLayer

  private globe: Mesh | null = null
  private atmosphere: Mesh | null = null
  private shader: ShaderMaterial | null = null
  private heat: HeatMap | null = null
  private customLines = new Group()
  private borderMaterial: LineBasicMaterial | null = null
  private borderRanges = new Map<string, { start: number; count: number }>()
  private hoverBorders: LineSegments | null = null
  private selectedBorders: LineSegments | null = null
  private borders: LineSegments | null = null
  private readonly globeSphere = new Sphere(new Vector3(), GLOBE_RADIUS)
  private readonly hitPoint = new Vector3()
  private pointerDirty = false
  private onScreen = true
  private readonly visibilityObserver: IntersectionObserver | null
  private pixelRatio = 1
  private maxPixelRatio = 1
  private frameMs = 16
  private frameCount = 0
  private lastFrame = 0
  private hoverCtx: CanvasRenderingContext2D | null = null
  private hoverTexture: CanvasTexture | null = null
  private hoverMat: ShaderMaterial | null = null
  private selectedCtx: CanvasRenderingContext2D | null = null
  private selectedTexture: CanvasTexture | null = null
  private selectedMat: ShaderMaterial | null = null
  private regionFillCtx: CanvasRenderingContext2D | null = null
  private regionFillTexture: CanvasTexture | null = null
  private regionFillMat: ShaderMaterial | null = null
  private regionFillPainted = false
  private features: IndexedFeature[] = []
  private raw = new Map<string, { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] }>()
  private names = new Map<string, string>()

  private options: GlobeViewOptions = {
    regions: [],
    markers: [],
    arcs: [],
    config: defaultConfig,
  }

  private cameraKey = ''
  private distance = defaultConfig.camera.distance
  private targetDistance = defaultConfig.camera.distance
  private flight: Flight | null = null
  private readonly pointers = new Map<number, { x: number; y: number }>()
  private pinchStart = 0
  private pinchBase = 0
  private yaw = 0
  private pitch = 0.15
  private dragging = false
  private moved = false
  private pointerDown = { x: 0, y: 0 }
  private hoveredId: string | null = null
  private hoveredMarkerId: string | null = null
  private pinnedId: string | null = null
  private selectedId: string | null = null
  private disposed = false
  private loaded = false
  private raf = 0
  private elapsed = 0

  constructor(
    canvas: HTMLCanvasElement,
    private readonly root: HTMLElement,
    private readonly handlers: GlobeViewHandlers,
    private readonly assets: GlobeAssets = {},
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: window.devicePixelRatio <= 1,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.25
    this.maxPixelRatio = Math.min(window.devicePixelRatio, 1.75)
    this.pixelRatio = this.maxPixelRatio
    this.renderer.setPixelRatio(this.pixelRatio)

    this.camera = new PerspectiveCamera(defaultConfig.camera.fov, 1, 0.1, 100)
    this.lookAt(defaultConfig.camera.lat, defaultConfig.camera.lng)
    this.scene.add(this.customLines)
    this.markerLayer = new MarkerLayer(root)
    this.arcLayer = new ArcLayer()
    this.scene.add(this.markerLayer.group, this.arcLayer.group)

    this.resize()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(root)
    // Fora da tela não há por que desenhar.
    this.visibilityObserver =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver((entries) => {
            const last = entries[entries.length - 1]
            if (last) this.onScreen = last.isIntersecting
          })
    this.visibilityObserver?.observe(root)

    canvas.style.touchAction = 'none'
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
    canvas.addEventListener('pointerleave', this.onPointerLeave)

    this.raf = requestAnimationFrame(this.frame)
    void this.load()
  }

  setOptions(options: GlobeViewOptions) {
    const regionsChanged = this.regionsStamp(options.regions) !== this.regionsStamp(this.options.regions)
    const fillsChanged = this.fillsStamp(options.regions) !== this.fillsStamp(this.options.regions)
    this.options = options
    if (!this.loaded) return
    this.applyAppearance()
    if (regionsChanged) this.rebuildCustomLines()
    // Só as cores mudaram (mapa animado, como uma apuração): repinta a textura e mantém as linhas.
    else if (fillsChanged) this.paintRegionFills()
  }

  private regionsStamp(regions: Region[]) {
    return regions.map((region) => `${region.id}:${region.border ?? ''}:${region.locked ? 1 : 0}`).join('|')
  }

  private fillsStamp(regions: Region[]) {
    return regions.map((region) => region.fill ?? '').join('|')
  }

  focus(id: string, options?: FocusOptions) {
    const feature = this.features.find((item) => item.code === id)
    const region = this.options.regions.find((item) => item.id === id)
    if (feature) {
      const [minLng, minLat, maxLng, maxLat] = feature.bbox
      this.flyTo((minLat + maxLat) / 2, (minLng + maxLng) / 2, options)
      return
    }
    if (!region) {
      const marker = this.markerLayer.positionOf(id)
      if (marker) this.flyTo(marker.lat, marker.lng, options)
      return
    }
    const ring = region.geometry.type === 'Polygon' ? region.geometry.coordinates[0] : region.geometry.coordinates[0]?.[0]
    if (!ring?.length) return
    const lng = ring.reduce((sum, point) => sum + point[0], 0) / ring.length
    const lat = ring.reduce((sum, point) => sum + point[1], 0) / ring.length
    this.flyTo(lat, lng, options)
  }

  // Voo suave até um ponto, pelo caminho mais curto em longitude. Qualquer gesto do usuário cancela.
  private flyTo(lat: number, lng: number, options: FocusOptions = {}) {
    const duration = options.duration ?? DEFAULT_FLIGHT_MS
    const [x, y, z] = latLngToSphere(lat, lng, 1)
    const pitch = Math.asin(Math.max(-1, Math.min(1, y)))
    let yaw = Math.atan2(x, z)
    const distance = Math.max(
      this.options.config.minDistance,
      Math.min(this.options.config.maxDistance, options.distance ?? this.targetDistance),
    )
    if (duration <= 0 || !this.loaded) {
      this.flight = null
      this.yaw = yaw
      this.pitch = pitch
      this.distance = this.targetDistance = distance
      this.applyOrbit()
      return
    }
    const turn = ((yaw - this.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
    yaw = this.yaw + turn
    this.flight = {
      from: { yaw: this.yaw, pitch: this.pitch, distance: this.distance },
      to: { yaw, pitch, distance },
      start: performance.now(),
      duration,
    }
    this.targetDistance = distance
  }

  // Destaque fixo: o hover do ponteiro pinta por cima, mas ao sair da região volta para ele.
  highlight(id: string | null) {
    this.pinnedId = id
    this.setHover(id)
  }

  clear() {
    this.selectedId = null
    this.pinnedId = null
    this.setHover(null)
    this.paintSelected(null)
  }

  destroy() {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    this.visibilityObserver?.disconnect()
    const canvas = this.renderer.domElement
    canvas.removeEventListener('wheel', this.onWheel)
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerUp)
    canvas.removeEventListener('pointerleave', this.onPointerLeave)
    this.heat?.dispose()
    this.borders?.geometry.dispose()
    this.borderMaterial?.dispose()
    this.hoverBorders?.geometry.dispose()
    this.selectedBorders?.geometry.dispose()
    this.hoverBorders?.material instanceof LineBasicMaterial && this.hoverBorders.material.dispose()
    this.selectedBorders?.material instanceof LineBasicMaterial && this.selectedBorders.material.dispose()
    this.scene.remove(this.markerLayer.group, this.arcLayer.group)
    this.markerLayer.dispose()
    this.arcLayer.dispose()
    this.renderer.dispose()
  }

  private async load() {
    try {
      const urls = { ...defaultTextureUrls, ...this.assets.textures }
      const worldUrl = this.assets.world ?? defaultWorldUrl
      const [textures, response] = await Promise.all([
        Promise.all([
          this.loader.loadAsync(urls.color),
          this.loader.loadAsync(urls.sea),
          this.loader.loadAsync(urls.specular),
          this.loader.loadAsync(urls.bump),
          this.loader.loadAsync(urls.normal),
        ]),
        fetch(worldUrl).then((result) => {
          if (!result.ok) throw new Error(`Mapa não encontrado em ${worldUrl} (HTTP ${result.status})`)
          return result.json()
        }),
      ])
      if (this.disposed) return

      this.heat = new HeatMap()
      const lowPower = (navigator.hardwareConcurrency ?? 8) <= 4
      this.shader = createGlobeMaterial(
        textures[0],
        textures[1],
        textures[2],
        textures[3],
        textures[4],
        this.heat.texture,
        9,
        lowPower ? 3 : 4,
        lowPower ? 1 : 4,
        lowPower ? 1.9 : 1.1,
      )
      this.globe = new Mesh(buildSphere(GLOBE_RADIUS, 64, 64), this.shader)
      this.scene.add(this.globe)
      this.atmosphere = this.createAtmosphere()
      this.scene.add(this.atmosphere)
      this.createFillLayers()

      const world = await indexWorld(response)
      if (this.disposed) return
      this.features = world.features
      this.raw = world.raw
      for (const feature of world.features) this.names.set(feature.code, feature.name)
      this.addCountryLines(world.groups)
      this.loaded = true
      this.rebuildCustomLines()
      this.applyAppearance()
      this.handlers.onReady()
    } catch (error) {
      console.error('[vue-globe] Falha ao montar o globo:', error)
      this.handlers.onReady()
    }
  }

  private createAtmosphere() {
    const material = new ShaderMaterial({
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vWorldPos;
        void main() {
          vec3 normal = normalize(vWorldPos);
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float center = max(dot(viewDir, normal), 0.0);
          gl_FragColor = vec4(uColor, pow(center, 2.0) * 0.75);
        }
      `,
      uniforms: { uColor: { value: new Color(0x83a6ce).convertLinearToSRGB() } },
      transparent: false,
      blending: AdditiveBlending,
      depthWrite: false,
      side: FrontSide,
    })
    const mesh = new Mesh(buildSphere(GLOBE_RADIUS * 1.15, 32, 32), material)
    mesh.renderOrder = -1
    mesh.raycast = () => {}
    return mesh
  }

  private createFillLayers() {
    const geometry = buildSphere(GLOBE_RADIUS * 1.005, 64, 64)
    // Preenchimento das regiões (cor de cada `Region.fill`), por baixo do hover e da seleção.
    const regionFill = this.makeFillLayer(geometry, 1, '#ffffff', 1)
    const hover = this.makeFillLayer(geometry, 2, this.options.config.colors.hover, HIGHLIGHT_TEXTURE_SCALE)
    const selected = this.makeFillLayer(geometry, 3, this.options.config.colors.fill, HIGHLIGHT_TEXTURE_SCALE)
    this.regionFillCtx = regionFill.ctx
    this.regionFillTexture = regionFill.texture
    this.regionFillMat = regionFill.material
    this.hoverCtx = hover.ctx
    this.hoverTexture = hover.texture
    this.hoverMat = hover.material
    this.selectedCtx = selected.ctx
    this.selectedTexture = selected.texture
    this.selectedMat = selected.material
    this.scene.add(regionFill.mesh, hover.mesh, selected.mesh)
  }

  private makeFillLayer(geometry: BufferGeometry, order: number, color: string, scale: number) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(FILL_TEX_W * scale)
    canvas.height = Math.round(FILL_TEX_H * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D indisponível')
    // O desenho continua em coordenadas de 4096 x 2048; a escala cuida de caber no canvas menor.
    ctx.scale(scale, scale)
    const texture = new CanvasTexture(canvas)
    const material = createFillSphereMaterial(texture, color) as ShaderMaterial
    const mesh = new Mesh(geometry, material)
    mesh.renderOrder = order
    mesh.raycast = () => {}
    return { ctx, texture, material, mesh }
  }

  // Todas as bordas dos países viram um único objeto (uma chamada de desenho). O destaque de hover e de
  // seleção reaproveita os mesmos buffers e só muda o trecho desenhado.
  private addCountryLines(groups: CountryLines[]) {
    const polylines = groups.flatMap((group) => group.geometries)
    const { position, index, counts } = mergePolylines(polylines)

    this.borderRanges.clear()
    let polyline = 0
    let start = 0
    for (const group of groups) {
      let count = 0
      for (let i = 0; i < group.geometries.length; i++) count += counts[polyline++] ?? 0
      this.borderRanges.set(group.code, { start, count })
      start += count
    }

    const positionAttribute = new BufferAttribute(position, 3)
    const indexAttribute = new BufferAttribute(index, 1)
    const makeLines = (opacity: number, order: number) => {
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', positionAttribute)
      geometry.setIndex(indexAttribute)
      const material = new LineBasicMaterial({
        color: new Color(this.options.config.colors.border),
        transparent: true,
        opacity,
        depthTest: true,
        depthWrite: false,
      })
      const lines = new LineSegments(geometry, material)
      lines.raycast = () => {}
      lines.frustumCulled = false
      lines.renderOrder = order
      this.scene.add(lines)
      return lines
    }
    this.borders = makeLines(this.options.config.lineOpacity, 0)
    this.borderMaterial = this.borders.material as LineBasicMaterial
    this.hoverBorders = makeLines(1, 0)
    this.selectedBorders = makeLines(1, 0)
    this.hoverBorders.visible = false
    this.selectedBorders.visible = false
  }

  private applyBorderHighlight() {
    const show = (lines: LineSegments | null, id: string | null) => {
      if (!lines) return
      const range = id ? this.borderRanges.get(id) : undefined
      lines.visible = !!range && this.options.config.showLines
      if (range) lines.geometry.setDrawRange(range.start, range.count)
    }
    show(this.hoverBorders, this.hoveredId !== this.selectedId ? this.hoveredId : null)
    show(this.selectedBorders, this.selectedId)
  }

  private rebuildCustomLines() {
    // Os materiais antigos só são descartados depois de criar os novos: se o programa de shader perdesse
    // o último uso no meio da troca, o WebGL teria de compilá-lo de novo a cada atualização.
    const previous = [...this.customLines.children]
    this.paintRegionFills()

    // Uma chamada de desenho por cor de borda, não uma por anel de cada região.
    const byColor = new Map<string, BufferGeometry[]>()
    for (const region of this.options.regions) {
      const polygons = region.geometry.type === 'Polygon' ? [region.geometry.coordinates] : region.geometry.coordinates
      const color = region.border ?? this.options.config.colors.border
      const list = byColor.get(color) ?? []
      for (const polygon of polygons) list.push(...buildRings(polygon, GLOBE_RADIUS))
      byColor.set(color, list)
    }
    for (const [color, geometries] of byColor) {
      if (!geometries.length) continue
      const { position, index } = mergePolylines(geometries)
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new BufferAttribute(position, 3))
      geometry.setIndex(new BufferAttribute(index, 1))
      const material = new LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
      const lines = new LineSegments(geometry, material)
      lines.raycast = () => {}
      lines.frustumCulled = false
      this.customLines.add(lines)
    }
    for (const child of previous) {
      this.customLines.remove(child)
      if (child instanceof LineSegments) {
        child.geometry.dispose()
        if (child.material instanceof LineBasicMaterial) child.material.dispose()
      }
    }
  }

  // Pinta, em uma textura sobre a esfera, a cor de cada região que tem `fill`. A última da lista fica por cima.
  private paintRegionFills() {
    if (!this.regionFillCtx || !this.regionFillTexture) return
    this.regionFillCtx.clearRect(0, 0, FILL_TEX_W, FILL_TEX_H)
    this.regionFillPainted = false
    for (const region of this.options.regions) {
      if (!region.fill) continue
      paintGeometry(
        this.regionFillCtx,
        { type: region.geometry.type, coordinates: region.geometry.coordinates },
        false,
        region.fill,
      )
      this.regionFillPainted = true
    }
    this.regionFillTexture.needsUpdate = true
    this.applyRegionFillOpacity()
  }

  private applyRegionFillOpacity() {
    const opacity = this.regionFillMat?.uniforms.uOpacity
    if (opacity) opacity.value = this.regionFillPainted ? this.options.config.regionOpacity : 0
  }

  private applyAppearance() {
    const { config } = this.options
    if (this.borders) this.borders.visible = config.showLines
    this.customLines.visible = config.showLines
    this.markerLayer.configure(this.options.markers, config)
    this.arcLayer.configure(this.options.arcs, config)
    this.applyRegionFillOpacity()

    const border = new Color(config.colors.border)
    if (this.borderMaterial) {
      this.borderMaterial.color.copy(border)
      this.borderMaterial.opacity = config.lineOpacity
    }
    for (const lines of [this.hoverBorders, this.selectedBorders]) {
      if (lines?.material instanceof LineBasicMaterial) lines.material.color.copy(border)
    }
    this.applyBorderHighlight()

    this.setColor('uOceanTint', config.colors.ocean, true)
    this.setColor('uLandColor', config.colors.land)
    this.setColor('uGridLineColor', config.colors.grid)
    this.setNumber('uGridLineOpacity', config.showGrid ? config.gridOpacity : 0)
    this.setNumber('uNoiseStrength', config.showClouds ? 0.9 : 0)
    this.setNumber('uAutoCellOpacity', config.showCells ? 1 : 0)
    this.setNumber('uHoverCellOpacity', config.showCells ? 1 : 0)

    if (this.atmosphere) {
      this.atmosphere.visible = config.showAtmosphere
      const material = this.atmosphere.material
      if (material instanceof ShaderMaterial && material.uniforms.uColor) {
        material.uniforms.uColor.value = new Color(config.colors.atmosphere).convertLinearToSRGB()
      }
    }

    if (this.hoverMat?.uniforms.uColor) this.hoverMat.uniforms.uColor.value = new Color(config.colors.hover)
    if (this.selectedMat?.uniforms.uColor) this.selectedMat.uniforms.uColor.value = new Color(config.colors.fill)

    if (this.camera.fov !== config.camera.fov) {
      this.camera.fov = config.camera.fov
      this.camera.updateProjectionMatrix()
    }

    const cameraKey = `${config.camera.lat}|${config.camera.lng}|${config.camera.distance}|${config.camera.fov}`
    if (cameraKey !== this.cameraKey) {
      this.cameraKey = cameraKey
      this.distance = this.targetDistance = config.camera.distance
      this.flight = null
      this.lookAt(config.camera.lat, config.camera.lng)
    }
  }

  private setColor(name: string, hex: string, srgb = false) {
    const uniform = this.shader?.uniforms[name]
    if (!uniform) return
    const color = new Color(hex)
    uniform.value = srgb ? color.convertLinearToSRGB() : color
  }

  private setNumber(name: string, value: number) {
    const uniform = this.shader?.uniforms[name]
    if (uniform) uniform.value = value
  }

  private lookAt(lat: number, lng: number) {
    const [x, y, z] = latLngToSphere(lat, lng, this.distance)
    this.pitch = Math.asin(Math.max(-1, Math.min(1, y / this.distance)))
    this.yaw = Math.atan2(x, z)
    this.applyOrbit()
  }

  private applyOrbit() {
    const cosPitch = Math.cos(this.pitch)
    this.camera.position.set(
      this.distance * Math.sin(this.yaw) * cosPitch,
      this.distance * Math.sin(this.pitch),
      this.distance * Math.cos(this.yaw) * cosPitch,
    )
    this.camera.lookAt(0, 0, 0)
  }

  private resize = () => {
    const width = this.root.clientWidth
    const height = this.root.clientHeight
    if (width < 2 || height < 2) return
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(this.pixelRatio)
    this.renderer.setSize(width, height, false)
  }

  private frame = (now: number) => {
    if (this.disposed) return
    const delta = this.elapsed ? Math.min((now - this.elapsed) / 1000, 0.05) : 0
    this.elapsed = now
    if (!this.onScreen) {
      this.lastFrame = 0
      this.raf = requestAnimationFrame(this.frame)
      return
    }
    this.tuneResolution(now)

    // O hover é resolvido uma vez por quadro, não uma vez por evento de ponteiro (que pode chegar a mais de 100 por segundo).
    if (this.pointerDirty && !this.dragging) {
      this.pointerDirty = false
      this.updateHover()
    }

    if (this.flight) {
      const t = Math.min(1, (performance.now() - this.flight.start) / this.flight.duration)
      const e = easeInOut(t)
      const { from, to } = this.flight
      this.yaw = from.yaw + (to.yaw - from.yaw) * e
      this.pitch = from.pitch + (to.pitch - from.pitch) * e
      this.distance = from.distance + (to.distance - from.distance) * e
      if (t >= 1) this.flight = null
      this.applyOrbit()
    } else {
      if (Math.abs(this.targetDistance - this.distance) > 0.0005) {
        // Aproximação exponencial: o zoom da roda desacelera até parar, em vez de saltar.
        this.distance += (this.targetDistance - this.distance) * (1 - Math.exp(-delta * 12))
        this.applyOrbit()
      }
      if (this.options.config.autoRotate && !this.dragging) {
        this.yaw += delta * this.options.config.rotateSpeed
        this.applyOrbit()
      }
    }

    if (this.shader) {
      const time = this.shader.uniforms.uTime
      if (time) time.value = (now / 1000) % 10000
      const mouse = this.shader.uniforms.uMouseUV?.value as Vector2 | undefined
      this.heat?.update(mouse && mouse.x >= 0 ? mouse : null)
    }

    this.markerLayer.update(this.camera, this.root.clientWidth, this.root.clientHeight, now)
    this.arcLayer.update(now)

    this.renderer.render(this.scene, this.camera)
    this.raf = requestAnimationFrame(this.frame)
  }

  // Se o quadro demora para sair, desenha em resolução menor. Só desce, nunca volta, para não oscilar.
  private tuneResolution(now: number) {
    if (this.lastFrame) {
      const interval = now - this.lastFrame
      if (interval < 250) this.frameMs += (interval - this.frameMs) * 0.1
    }
    this.lastFrame = now
    if (++this.frameCount % 45 !== 0 || this.frameCount < 90) return
    if (this.frameMs > 24 && this.pixelRatio > MIN_PIXEL_RATIO) {
      this.pixelRatio = Math.max(MIN_PIXEL_RATIO, this.pixelRatio - 0.25)
      this.resize()
      this.frameMs = 16
    }
  }

  // Ponto do globo sob o ponteiro. Conta direta de raio com esfera, sem testar os triângulos da malha.
  private castGlobe() {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const point = this.raycaster.ray.intersectSphere(this.globeSphere, this.hitPoint)
    if (!point) return null
    return { point, distance: this.raycaster.ray.origin.distanceTo(point) }
  }

  private pick(cast: ReturnType<GlobeView['castGlobe']>) {
    if (!this.globe || !this.options.config.interactive) return null
    const mouse = this.shader?.uniforms.uMouseUV?.value as Vector2 | undefined
    if (!cast) {
      mouse?.set(-1, -1)
      return null
    }
    const { lat, lng } = sphereToLatLng(cast.point.x, cast.point.y, cast.point.z)
    // Mesma projeção do shader: u pela longitude e v pela latitude.
    mouse?.set((lng + 180) / 360, (lat + 90) / 180)

    const custom = findRegion(this.options.regions, lng, lat)
    const feature = custom ? null : findFeatureAtLatLng(lat, lng, this.features)
    const region = custom ?? (feature ? this.toRegion(feature) : null)
    if (!region) return null
    return { region, lat, lng }
  }

  private toRegion(feature: IndexedFeature): Region {
    return {
      id: feature.code,
      name: feature.name && feature.name !== feature.code ? feature.name : countryName(feature.code, this.options.config.locale),
      geometry: {
        type: feature.type,
        coordinates: feature.coordinates,
      } as Region['geometry'],
    }
  }

  private setHover(id: string | null) {
    this.hoveredId = id
    this.applyBorderHighlight()
    this.paintHover(id && id !== this.selectedId ? id : null)
  }

  private paintHover(id: string | null) {
    if (!this.hoverCtx || !this.hoverTexture || !this.hoverMat) return
    this.hoverCtx.clearRect(0, 0, FILL_TEX_W, FILL_TEX_H)
    // geometryFor inclui as regiões do usuário, então o hover e o destaque também funcionam nelas.
    const geometry = id ? this.geometryFor(id) : null
    if (geometry) paintGeometry(this.hoverCtx, geometry, false)
    this.hoverTexture.needsUpdate = true
    const opacity = this.hoverMat.uniforms.uOpacity
    if (opacity) opacity.value = geometry ? this.options.config.fillOpacity : 0
  }

  private paintSelected(id: string | null) {
    if (!this.selectedCtx || !this.selectedTexture || !this.selectedMat) return
    this.selectedCtx.clearRect(0, 0, FILL_TEX_W, FILL_TEX_H)
    const geometry = id ? this.geometryFor(id) : null
    if (geometry) {
      const region = this.options.regions.find((item) => item.id === id)
      paintGeometry(this.selectedCtx, geometry, region?.locked ?? false, '#ffffff')
    }
    this.selectedTexture.needsUpdate = true
    const opacity = this.selectedMat.uniforms.uOpacity
    if (opacity) opacity.value = geometry ? this.options.config.fillOpacity : 0
  }

  private geometryFor(id: string) {
    const stored = this.raw.get(id)
    if (stored) return stored
    const region = this.options.regions.find((item) => item.id === id)
    if (!region) return null
    return { type: region.geometry.type, coordinates: region.geometry.coordinates }
  }

  private onWheel = (event: WheelEvent) => {
    const { config } = this.options
    if (!config.interactive || !config.zoom) return
    // Rola o zoom do globo em vez da página enquanto o ponteiro está sobre ele.
    event.preventDefault()
    this.flight = null
    const lines = event.deltaMode === 1 ? 16 : 1
    const factor = Math.exp(event.deltaY * lines * 0.0012)
    this.targetDistance = this.clampDistance(this.targetDistance * factor)
  }

  private clampDistance(distance: number) {
    const { minDistance, maxDistance } = this.options.config
    return Math.max(minDistance, Math.min(maxDistance, distance))
  }

  private pinchDistance() {
    const [a, b] = [...this.pointers.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }

  private onPointerDown = (event: PointerEvent) => {
    if (!this.options.config.interactive) return
    this.flight = null
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (this.pointers.size === 2 && this.options.config.zoom) {
      this.pinchStart = this.pinchDistance()
      this.pinchBase = this.targetDistance
    }
    this.setPointer(event)
    this.dragging = true
    this.moved = false
    this.pointerDown = { x: event.clientX, y: event.clientY }
  }

  private onPointerMove = (event: PointerEvent) => {
    this.setPointer(event)
    if (this.pointers.has(event.pointerId)) this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (this.dragging && this.pinchStart > 0 && this.pointers.size >= 2) {
      // Dois dedos: a distância entre eles controla o zoom, e o globo não gira.
      this.moved = true
      const current = this.pinchDistance()
      if (current > 0) {
        this.targetDistance = this.clampDistance((this.pinchBase * this.pinchStart) / current)
        this.distance = this.targetDistance
        this.applyOrbit()
      }
      return
    }
    if (this.dragging) {
      // Perto do globo o mesmo arrasto gira menos, para o movimento acompanhar o dedo.
      const near = Math.max(0.25, Math.min(1.5, (this.distance - GLOBE_RADIUS) / (defaultConfig.camera.distance - GLOBE_RADIUS)))
      const dx = event.clientX - this.pointerDown.x
      const dy = event.clientY - this.pointerDown.y
      if (dx * dx + dy * dy > 16) this.moved = true
      this.yaw -= event.movementX * 0.005 * near
      this.pitch = Math.max(-1.05, Math.min(1.05, this.pitch - event.movementY * 0.003 * near))
      this.applyOrbit()
    }

    this.pointerDirty = !this.dragging
  }

  private updateHover() {
    const cast = this.castGlobe()
    const hit = this.pick(cast)
    const nextId = hit?.region.id ?? this.pinnedId
    if (nextId !== this.hoveredId) {
      this.setHover(nextId)
      this.handlers.onHover(hit)
    }

    const marker = this.pickMarker(cast)
    this.setMarkerHover(marker)
    this.renderer.domElement.style.cursor = hit || marker ? 'pointer' : 'grab'
  }

  // Marcador sob o ponteiro, se não estiver escondido atrás do globo. Usa o raio já preparado em castGlobe.
  private pickMarker(cast: ReturnType<GlobeView['castGlobe']>) {
    if (!this.options.config.interactive) return null
    return this.markerLayer.pick(this.raycaster, cast ? cast.distance + 0.05 : Infinity)
  }

  private setMarkerHover(marker: GlobeMarker | null) {
    const id = marker?.id ?? null
    if (id === this.hoveredMarkerId) return
    this.hoveredMarkerId = id
    this.markerLayer.setHover(id)
    this.handlers.onMarkerHover(marker)
  }

  private onPointerUp = (event: PointerEvent) => {
    this.pointers.delete(event.pointerId)
    if (this.pointers.size < 2) this.pinchStart = 0
    if (!this.dragging) return
    this.setPointer(event)
    this.dragging = false
    this.pointerDirty = true
    if (this.moved || !this.options.config.interactive) return
    const cast = this.castGlobe()
    const marker = this.pickMarker(cast)
    if (marker) {
      this.handlers.onMarkerClick(marker)
      return
    }
    const hit = this.pick(cast)
    if (hit) {
      this.selectedId = hit.region.id
      this.applyBorderHighlight()
      this.paintSelected(hit.region.id)
      this.paintHover(null)
      this.handlers.onClick(hit)
      return
    }
    if (this.selectedId) {
      this.selectedId = null
      this.applyBorderHighlight()
      this.paintSelected(null)
      this.handlers.onMiss()
    }
  }

  private onPointerLeave = () => {
    const rest = this.selectedId ?? this.pinnedId
    if (this.hoveredId && this.hoveredId !== rest) this.setHover(rest)
    else if (!this.selectedId) this.setHover(this.pinnedId)
    if (!this.selectedId) this.handlers.onHover(null)
    this.setMarkerHover(null)
    this.renderer.domElement.style.cursor = 'grab'
    const mouse = this.shader?.uniforms.uMouseUV?.value as Vector2 | undefined
    mouse?.set(-1, -1)
  }

  private setPointer(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }
}
