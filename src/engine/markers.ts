import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  type PerspectiveCamera,
  type Raycaster,
} from 'three'

import type { GlobeConfig, GlobeMarker } from '@/types'

import { GLOBE_RADIUS, latLngToSphere } from './geo'

// Pino levemente acima da superfície, para não brigar em profundidade com o globo.
const LIFT = 1.012
// A área de clique é maior que o ponto desenhado, para ficar fácil de acertar.
const HIT_SCALE = 2.6
const HOVER_SCALE = 1.5
const PULSE_SECONDS = 2
// A haste de um pino com altura começa na superfície, um pouco acima das bordas dos países.
const STEM_START = 1.003
const MAX_ALTITUDE = 5

interface MarkerItem {
  marker: GlobeMarker
  position: Vector3
  normal: Vector3
  altitude: number
  /** Posição da haste no buffer de linhas, ou -1 quando o pino está no chão. */
  stem: number
  dot: Mesh
  halo: Mesh
  hit: Mesh
  label: HTMLDivElement | null
  materials: MarkerMaterials
  /** Do lado do globo voltado para a câmera. Atualizado a cada quadro. */
  facing: boolean
}

interface MarkerMaterials {
  dot: MeshBasicMaterial
  halo: MeshBasicMaterial
}

export class MarkerLayer {
  readonly group = new Group()

  private readonly items = new Map<string, MarkerItem>()
  private readonly hitMeshes: Mesh[] = []
  private readonly materials = new Map<string, MarkerMaterials>()
  private readonly geometry = new SphereGeometry(1, 16, 12)
  private readonly hitMaterial = new MeshBasicMaterial({ visible: false })
  private readonly labelHost: HTMLDivElement
  private readonly cameraPosition = new Vector3()
  private readonly cameraDirection = new Vector3()
  private readonly projected = new Vector3()
  private readonly toMarker = new Vector3()
  private stems: LineSegments | null = null

  private config: GlobeConfig | null = null
  private stamp = ''
  private positionStamp = ''
  private hoveredId: string | null = null
  private labelsHidden = false

  constructor(root: HTMLElement) {
    this.group.visible = false
    this.labelHost = document.createElement('div')
    Object.assign(this.labelHost.style, {
      position: 'absolute',
      inset: '0',
      overflow: 'hidden',
      pointerEvents: 'none',
    })
    root.appendChild(this.labelHost)
  }

  /** Chamado depois que o globo carregou e a cada mudança de props ou config. */
  configure(markers: GlobeMarker[], config: GlobeConfig) {
    this.config = config
    this.group.visible = config.showMarkers
    const stamp = this.stampOf(markers, config)
    if (stamp !== this.stamp) {
      this.stamp = stamp
      this.positionStamp = this.positionStampOf(markers)
      this.rebuild(markers, config)
      return
    }
    // Só as coordenadas mudaram (marcador em movimento): move os pinos sem recriar nada.
    const positionStamp = this.positionStampOf(markers)
    if (positionStamp === this.positionStamp) return
    this.positionStamp = positionStamp
    this.move(markers)
  }

  setHover(id: string | null) {
    this.hoveredId = id
  }

  positionOf(id: string) {
    const marker = this.items.get(id)?.marker
    return marker ? { lat: marker.lat, lng: marker.lng } : null
  }

  /**
   * Marcador sob o ponteiro. `maxDistance` é a distância até o globo naquele ponto:
   * marcador mais longe que isso está do outro lado e não pode ser clicado.
   */
  pick(raycaster: Raycaster, maxDistance: number): GlobeMarker | null {
    if (!this.group.visible || !this.hitMeshes.length) return null
    for (const hit of raycaster.intersectObjects(this.hitMeshes, false)) {
      if (hit.distance > maxDistance) continue
      const id = hit.object.userData.markerId as string | undefined
      const item = id ? this.items.get(id) : undefined
      if (item?.facing) return item.marker
    }
    return null
  }

  private hideLabels() {
    if (this.labelsHidden) return
    this.labelsHidden = true
    for (const item of this.items.values()) {
      if (item.label) item.label.style.opacity = '0'
    }
  }

  update(camera: PerspectiveCamera, width: number, height: number, now: number) {
    const config = this.config
    if (!config || !this.items.size) return
    if (!this.group.visible) {
      this.hideLabels()
      return
    }
    this.labelsHidden = false

    this.cameraPosition.copy(camera.position)
    const distance = this.cameraPosition.length() || 1
    this.cameraDirection.copy(this.cameraPosition).divideScalar(distance)
    // Um ponto da superfície aparece para a câmera quando normal · direção > raio / distância.
    const limit = GLOBE_RADIUS / distance
    const pulse = ((now / 1000) % PULSE_SECONDS) / PULSE_SECONDS

    for (const material of this.materials.values()) material.halo.opacity = 0.5 * (1 - pulse)

    for (const item of this.items.values()) {
      const hovered = item.marker.id === this.hoveredId
      const size = config.markerSize * (hovered ? HOVER_SCALE : 1)
      // Pino e rótulo somem juntos no horizonte, para o pino não flutuar para fora da borda do globo.
      const facing = this.isVisible(item, limit)
      item.facing = facing
      item.dot.visible = facing
      item.halo.visible = facing
      item.dot.scale.setScalar(size)
      item.halo.scale.setScalar(size * (1 + pulse * 2.4))

      if (!item.label) continue
      const show = facing && (config.markerLabels === 'always' || hovered)
      if (show) {
        this.projected.copy(item.position).project(camera)
        const x = (this.projected.x * 0.5 + 0.5) * width
        const y = (-this.projected.y * 0.5 + 0.5) * height
        item.label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, calc(-100% - 12px))`
      }
      item.label.style.opacity = show ? '1' : '0'
    }
  }

  dispose() {
    this.clear()
    for (const material of this.materials.values()) {
      material.dot.dispose()
      material.halo.dispose()
    }
    this.materials.clear()
    this.geometry.dispose()
    this.hitMaterial.dispose()
    this.labelHost.remove()
  }

  private stampOf(markers: GlobeMarker[], config: GlobeConfig) {
    const list = markers.map((m) => `${m.id}:${m.label ?? ''}:${m.color ?? ''}:${Number.isFinite(m.lat + m.lng)}:${altitudeOf(m) > 0 ? 1 : 0}`).join('|')
    const { colors } = config
    return `${list}#${colors.marker}|${colors.label}|${colors.labelBackground}|${config.markerLabels}`
  }

  private positionStampOf(markers: GlobeMarker[]) {
    return markers.map((m) => `${m.lat}:${m.lng}:${m.altitude ?? 0}`).join('|')
  }

  private move(markers: GlobeMarker[]) {
    const moved = new Set<string>()
    for (const marker of markers) {
      const item = this.items.get(marker.id)
      if (!item || moved.has(marker.id) || !Number.isFinite(marker.lat + marker.lng)) continue
      moved.add(marker.id)
      const altitude = altitudeOf(marker)
      const [x, y, z] = latLngToSphere(marker.lat, marker.lng, GLOBE_RADIUS * (LIFT + altitude))
      item.marker = marker
      item.altitude = altitude
      item.position.set(x, y, z)
      item.normal.copy(item.position).normalize()
      for (const mesh of [item.dot, item.halo, item.hit]) mesh.position.copy(item.position)
      this.writeStem(item)
    }
    if (this.stems) this.stems.geometry.getAttribute('position').needsUpdate = true
  }

  private rebuild(markers: GlobeMarker[], config: GlobeConfig) {
    this.clear()
    const usedColors = new Set<string>()
    for (const marker of markers) {
      if (!Number.isFinite(marker.lat) || !Number.isFinite(marker.lng)) continue
      if (this.items.has(marker.id)) continue

      const altitude = altitudeOf(marker)
      const [x, y, z] = latLngToSphere(marker.lat, marker.lng, GLOBE_RADIUS * (LIFT + altitude))
      const position = new Vector3(x, y, z)
      const color = marker.color ?? config.colors.marker
      usedColors.add(color)
      const materials = this.materialsFor(color)

      const dot = new Mesh(this.geometry, materials.dot)
      const halo = new Mesh(this.geometry, materials.halo)
      const hit = new Mesh(this.geometry, this.hitMaterial)
      for (const mesh of [dot, halo, hit]) mesh.position.copy(position)
      dot.renderOrder = 6
      halo.renderOrder = 5
      dot.raycast = () => {}
      halo.raycast = () => {}
      hit.scale.setScalar(config.markerSize * HIT_SCALE)
      hit.userData.markerId = marker.id
      this.group.add(halo, dot, hit)
      this.hitMeshes.push(hit)

      this.items.set(marker.id, {
        marker,
        position,
        normal: position.clone().normalize(),
        altitude,
        stem: -1,
        dot,
        halo,
        hit,
        label: marker.label && config.markerLabels !== 'never' ? this.createLabel(marker.label, config) : null,
        materials,
        facing: false,
      })
    }

    this.buildStems(markers, config)

    // Descarta os materiais de cores que não estão mais em uso.
    for (const [color, material] of this.materials) {
      if (usedColors.has(color)) continue
      material.dot.dispose()
      material.halo.dispose()
      this.materials.delete(color)
    }
  }

  // Uma única linha por pino com altura, todas no mesmo objeto, ligando o chão ao pino.
  private buildStems(markers: GlobeMarker[], config: GlobeConfig) {
    const elevated = [...this.items.values()].filter((item) => item.altitude > 0)
    if (!elevated.length) return
    const colors: number[] = []
    elevated.forEach((item, index) => {
      item.stem = index * 6
      const color = new Color(item.marker.color ?? config.colors.marker)
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b)
    })
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(elevated.length * 6), 3))
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
    this.stems = new LineSegments(
      geometry,
      new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false }),
    )
    this.stems.frustumCulled = false
    this.stems.raycast = () => {}
    this.stems.renderOrder = 5
    this.group.add(this.stems)
    for (const item of elevated) this.writeStem(item)
    this.stems.geometry.getAttribute('position').needsUpdate = true
    void markers
  }

  private writeStem(item: MarkerItem) {
    if (!this.stems || item.stem < 0) return
    const array = this.stems.geometry.getAttribute('position').array as Float32Array
    const foot = STEM_START / (LIFT + item.altitude)
    array[item.stem] = item.position.x * foot
    array[item.stem + 1] = item.position.y * foot
    array[item.stem + 2] = item.position.z * foot
    array[item.stem + 3] = item.position.x
    array[item.stem + 4] = item.position.y
    array[item.stem + 5] = item.position.z
  }

  /** Pino com altura aparece além da borda do globo; só some se o globo realmente estiver na frente dele. */
  private isVisible(item: MarkerItem, limit: number) {
    if (item.altitude <= 0) return item.normal.dot(this.cameraDirection) > limit
    const direction = this.toMarker.copy(item.position).sub(this.cameraPosition)
    const length = direction.length()
    if (length < 1e-6) return true
    direction.divideScalar(length)
    const closest = -this.cameraPosition.dot(direction)
    if (closest <= 0 || closest >= length) return true
    const gap = this.cameraPosition.lengthSq() - closest * closest
    return gap > GLOBE_RADIUS * GLOBE_RADIUS
  }

  private createLabel(text: string, config: GlobeConfig) {
    const element = document.createElement('div')
    // textContent: o texto do rótulo nunca é interpretado como HTML.
    element.textContent = text
    Object.assign(element.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      padding: '2px 8px',
      borderRadius: '999px',
      whiteSpace: 'nowrap',
      font: '600 12px/1.4 system-ui, sans-serif',
      color: config.colors.label,
      background: config.colors.labelBackground,
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 120ms',
      willChange: 'transform, opacity',
    })
    this.labelHost.appendChild(element)
    return element
  }

  private materialsFor(color: string): MarkerMaterials {
    const cached = this.materials.get(color)
    if (cached) return cached
    // toneMapped: false mantém a cor igual à que foi pedida, sem o ajuste de brilho do globo.
    const created = {
      dot: new MeshBasicMaterial({ color, toneMapped: false }),
      halo: new MeshBasicMaterial({
        color,
        toneMapped: false,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    }
    this.materials.set(color, created)
    return created
  }

  private clear() {
    for (const item of this.items.values()) {
      this.group.remove(item.dot, item.halo, item.hit)
      item.label?.remove()
    }
    this.items.clear()
    this.hitMeshes.length = 0
    if (this.stems) {
      this.group.remove(this.stems)
      this.stems.geometry.dispose()
      if (this.stems.material instanceof LineBasicMaterial) this.stems.material.dispose()
      this.stems = null
    }
  }
}

function altitudeOf(marker: GlobeMarker) {
  const value = marker.altitude ?? 0
  return Number.isFinite(value) ? Math.max(0, Math.min(MAX_ALTITUDE, value)) : 0
}
