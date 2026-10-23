import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  FrontSide,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  PerspectiveCamera,
  Raycaster,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  WebGLRenderer,
} from 'three'

import {
  defaultConfig,
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
  paintGeometry,
  type CountryLines,
  type IndexedFeature,
} from './borders'
import { findRegion, GLOBE_RADIUS, latLngToSphere } from './geo'
import { createFillSphereMaterial, createGlobeMaterial } from './globeShader.js'
import { HeatMap } from './heatmap'

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

export interface GlobeViewOptions {
  regions: Region[]
  markers: GlobeMarker[]
  config: GlobeConfig
}

export interface GlobeViewHandlers {
  onHover: (event: RegionPointerEvent | null) => void
  onClick: (event: RegionPointerEvent) => void
  onMiss: () => void
  onReady: () => void
}

export class GlobeView {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera: PerspectiveCamera
  private readonly raycaster = new Raycaster()
  private readonly pointer = new Vector2(-2, -2)
  private readonly resizeObserver: ResizeObserver
  private readonly loader = new TextureLoader()

  private globe: Mesh | null = null
  private atmosphere: Mesh | null = null
  private shader: ShaderMaterial | null = null
  private heat: HeatMap | null = null
  private countries = new Group()
  private customLines = new Group()
  private hoverCtx: CanvasRenderingContext2D | null = null
  private hoverTexture: CanvasTexture | null = null
  private hoverMat: ShaderMaterial | null = null
  private selectedCtx: CanvasRenderingContext2D | null = null
  private selectedTexture: CanvasTexture | null = null
  private selectedMat: ShaderMaterial | null = null
  private materials = new Map<string, LineBasicMaterial>()
  private features: IndexedFeature[] = []
  private raw = new Map<string, { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] }>()
  private names = new Map<string, string>()

  private options: GlobeViewOptions = {
    regions: [],
    markers: [],
    config: defaultConfig,
  }

  private cameraKey = ''
  private distance = defaultConfig.camera.distance
  private yaw = 0
  private pitch = 0.15
  private dragging = false
  private moved = false
  private pointerDown = { x: 0, y: 0 }
  private hoveredId: string | null = null
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))

    this.camera = new PerspectiveCamera(defaultConfig.camera.fov, 1, 0.1, 100)
    this.lookAt(defaultConfig.camera.lat, defaultConfig.camera.lng)
    this.scene.add(this.countries, this.customLines)

    this.resize()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(root)

    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointerleave', this.onPointerLeave)

    this.raf = requestAnimationFrame(this.frame)
    void this.load()
  }

  setOptions(options: GlobeViewOptions) {
    const regionsChanged = this.regionsStamp(options.regions) !== this.regionsStamp(this.options.regions)
    this.options = options
    if (!this.loaded) return
    this.applyAppearance()
    if (regionsChanged) this.rebuildCustomLines()
  }

  private regionsStamp(regions: Region[]) {
    return regions.map((region) => `${region.id}:${region.border ?? ''}:${region.fill ?? ''}:${region.locked ? 1 : 0}`).join('|')
  }

  focus(id: string) {
    const feature = this.features.find((item) => item.code === id)
    const region = this.options.regions.find((item) => item.id === id)
    if (feature) {
      const [minLng, minLat, maxLng, maxLat] = feature.bbox
      this.lookAt((minLat + maxLat) / 2, (minLng + maxLng) / 2)
      return
    }
    if (!region) return
    const ring = region.geometry.type === 'Polygon' ? region.geometry.coordinates[0] : region.geometry.coordinates[0]?.[0]
    if (!ring?.length) return
    const lng = ring.reduce((sum, point) => sum + point[0], 0) / ring.length
    const lat = ring.reduce((sum, point) => sum + point[1], 0) / ring.length
    this.lookAt(lat, lng)
  }

  highlight(id: string | null) {
    this.setHover(id)
  }

  clear() {
    this.selectedId = null
    this.setHover(null)
    this.paintSelected(null)
  }

  destroy() {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    canvas.removeEventListener('pointerleave', this.onPointerLeave)
    this.heat?.dispose()
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
    const hover = this.makeFillLayer(geometry, 2, this.options.config.colors.hover)
    const selected = this.makeFillLayer(geometry, 3, this.options.config.colors.fill)
    this.hoverCtx = hover.ctx
    this.hoverTexture = hover.texture
    this.hoverMat = hover.material
    this.selectedCtx = selected.ctx
    this.selectedTexture = selected.texture
    this.selectedMat = selected.material
    this.scene.add(hover.mesh, selected.mesh)
  }

  private makeFillLayer(geometry: BufferGeometry, order: number, color: string) {
    const canvas = document.createElement('canvas')
    canvas.width = FILL_TEX_W
    canvas.height = FILL_TEX_H
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D indisponível')
    const texture = new CanvasTexture(canvas)
    const material = createFillSphereMaterial(texture, color) as ShaderMaterial
    const mesh = new Mesh(geometry, material)
    mesh.renderOrder = order
    mesh.raycast = () => {}
    return { ctx, texture, material, mesh }
  }

  private addCountryLines(groups: CountryLines[]) {
    const color = new Color(this.options.config.colors.border)
    for (const group of groups) {
      const material = new LineBasicMaterial({
        color,
        transparent: true,
        opacity: this.options.config.lineOpacity,
        depthTest: true,
        depthWrite: false,
      })
      this.materials.set(group.code, material)
      for (const geometry of group.geometries) {
        const line = new Line(geometry, material)
        line.raycast = () => {}
        this.countries.add(line)
      }
    }
  }

  private rebuildCustomLines() {
    for (const child of [...this.customLines.children]) {
      this.customLines.remove(child)
      if (child instanceof Line) child.geometry.dispose()
    }
    for (const region of this.options.regions) {
      const polygons = region.geometry.type === 'Polygon' ? [region.geometry.coordinates] : region.geometry.coordinates
      const material = new LineBasicMaterial({
        color: region.border ?? this.options.config.colors.border,
        transparent: true,
        opacity: 0.9,
      })
      for (const polygon of polygons) {
        for (const geometry of buildRings(polygon, GLOBE_RADIUS)) {
          const line = new Line(geometry, material)
          line.raycast = () => {}
          this.customLines.add(line)
        }
      }
    }
  }

  private applyAppearance() {
    const { config } = this.options
    this.countries.visible = config.showLines
    this.customLines.visible = config.showLines

    const border = new Color(config.colors.border)
    for (const [code, material] of this.materials) {
      material.color.copy(border)
      if (code !== this.hoveredId && code !== this.selectedId) material.opacity = config.lineOpacity
    }

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
      this.distance = config.camera.distance
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
    this.renderer.setSize(width, height, false)
  }

  private frame = (now: number) => {
    if (this.disposed) return
    const delta = this.elapsed ? Math.min((now - this.elapsed) / 1000, 0.05) : 0
    this.elapsed = now

    if (this.options.config.autoRotate && !this.dragging) {
      this.yaw += delta * this.options.config.rotateSpeed
      this.applyOrbit()
    }

    if (this.shader) {
      const time = this.shader.uniforms.uTime
      if (time) time.value = (now / 1000) % 10000
      const mouse = this.shader.uniforms.uMouseUV?.value as Vector2 | undefined
      this.heat?.update(mouse && mouse.x >= 0 ? mouse : null)
    }

    this.renderer.render(this.scene, this.camera)
    this.raf = requestAnimationFrame(this.frame)
  }

  private pick() {
    if (!this.globe || !this.options.config.interactive) return null
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hit = this.raycaster.intersectObject(this.globe, false)[0]
    const mouse = this.shader?.uniforms.uMouseUV?.value as Vector2 | undefined
    if (!hit) {
      mouse?.set(-1, -1)
      return null
    }
    if (hit.uv && mouse) mouse.copy(hit.uv)

    const radius = hit.point.length() || 1
    const lat = (Math.asin(hit.point.y / radius) * 180) / Math.PI
    let lng = (Math.atan2(hit.point.z, -hit.point.x) * 180) / Math.PI - 180
    if (lng < -180) lng += 360

    const custom = findRegion(this.options.regions, lng, lat)
    const feature = custom ? null : findFeatureAtLatLng(lat, lng, this.features)
    const region = custom ?? (feature ? this.toRegion(feature) : null)
    if (!region) return null
    return { region, lat, lng }
  }

  private toRegion(feature: IndexedFeature): Region {
    return {
      id: feature.code,
      name: feature.name,
      geometry: {
        type: feature.type,
        coordinates: feature.coordinates,
      } as Region['geometry'],
    }
  }

  private setHover(id: string | null) {
    if (this.hoveredId && this.hoveredId !== this.selectedId) {
      const previous = this.materials.get(this.hoveredId)
      if (previous) previous.opacity = this.options.config.lineOpacity
    }
    this.hoveredId = id
    if (id && id !== this.selectedId) {
      const next = this.materials.get(id)
      if (next) next.opacity = 1
    }
    this.paintHover(id && id !== this.selectedId ? id : null)
  }

  private paintHover(id: string | null) {
    if (!this.hoverCtx || !this.hoverTexture || !this.hoverMat) return
    this.hoverCtx.clearRect(0, 0, FILL_TEX_W, FILL_TEX_H)
    const geometry = id ? this.raw.get(id) : null
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

  private onPointerDown = (event: PointerEvent) => {
    if (!this.options.config.interactive) return
    this.setPointer(event)
    this.dragging = true
    this.moved = false
    this.pointerDown = { x: event.clientX, y: event.clientY }
  }

  private onPointerMove = (event: PointerEvent) => {
    this.setPointer(event)
    if (this.dragging) {
      const dx = event.clientX - this.pointerDown.x
      const dy = event.clientY - this.pointerDown.y
      if (dx * dx + dy * dy > 16) this.moved = true
      this.yaw -= event.movementX * 0.005
      this.pitch = Math.max(-1.05, Math.min(1.05, this.pitch - event.movementY * 0.003))
      this.applyOrbit()
    }

    const hit = this.pick()
    const nextId = hit?.region.id ?? null
    if (nextId !== this.hoveredId) {
      this.setHover(nextId)
      this.handlers.onHover(hit)
      this.renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'
    }
  }

  private onPointerUp = (event: PointerEvent) => {
    if (!this.dragging) return
    this.setPointer(event)
    this.dragging = false
    if (this.moved || !this.options.config.interactive) return
    const hit = this.pick()
    if (hit) {
      this.selectedId = hit.region.id
      const material = this.materials.get(hit.region.id)
      if (material) material.opacity = 1
      this.paintSelected(hit.region.id)
      this.paintHover(null)
      this.handlers.onClick(hit)
      return
    }
    if (this.selectedId) {
      const material = this.materials.get(this.selectedId)
      if (material) material.opacity = this.options.config.lineOpacity
      this.selectedId = null
      this.paintSelected(null)
      this.handlers.onMiss()
    }
  }

  private onPointerLeave = () => {
    if (this.hoveredId && this.hoveredId !== this.selectedId) this.setHover(this.selectedId)
    else if (!this.selectedId) this.setHover(null)
    if (!this.selectedId) this.handlers.onHover(null)
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
