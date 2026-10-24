import { Color, Group, Mesh, QuadraticBezierCurve3, ShaderMaterial, TubeGeometry, Vector3 } from 'three'

import type { GlobeArc, GlobeConfig } from '@/types'

import { GLOBE_RADIUS, latLngToSphere } from './geo'

// Pontas do arco encostam na superfície; a altura cresce com a distância entre os pontos.
const SURFACE = 1.004
const MAX_ALTITUDE = 0.28
const MIN_ALTITUDE = 0.03
// Comprimento, em unidades do globo, de cada ciclo de traço mais vão.
const PERIOD = 0.55
// Parte do arco que fica sempre visível, para o trajeto inteiro aparecer mesmo entre os traços.
const BASE_ALPHA = 0.22

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uTime;
  uniform float uDash;
  uniform float uCycles;
  uniform float uSpeed;
  uniform float uBase;
  varying vec2 vUv;

  void main() {
    float t = vUv.x;
    vec3 color = mix(uColorA, uColorB, t);
    float alpha = 1.0;
    if (uDash < 1.0) {
      float phase = fract(t * uCycles - uTime * uSpeed);
      float edge = min(0.08, uDash * 0.5);
      float lit = smoothstep(0.0, edge, phase) * (1.0 - smoothstep(uDash - edge, uDash, phase));
      alpha = mix(uBase, 1.0, lit);
    }
    gl_FragColor = vec4(color, alpha);
  }
`

export class ArcLayer {
  readonly group = new Group()

  private readonly meshes: Mesh[] = []
  // Objeto compartilhado por todos os arcos: um só valor atualiza a animação inteira.
  private readonly time = { value: 0 }
  private stamp = ''

  constructor() {
    this.group.visible = false
  }

  /** Chamado depois que o globo carregou e a cada mudança de props ou config. */
  configure(arcs: GlobeArc[], config: GlobeConfig) {
    this.group.visible = config.showArcs
    const stamp = this.stampOf(arcs, config)
    if (stamp === this.stamp) return
    this.stamp = stamp
    this.rebuild(arcs, config)
  }

  update(now: number) {
    this.time.value = now / 1000
  }

  dispose() {
    this.clear()
  }

  private stampOf(arcs: GlobeArc[], config: GlobeConfig) {
    const list = arcs
      .map((a) => `${a.id}:${a.from.lat}:${a.from.lng}:${a.from.altitude ?? 0}:${a.to.lat}:${a.to.lng}:${a.to.altitude ?? 0}:${a.altitude ?? ''}:${[a.color ?? ''].flat().join('>')}`)
      .join('|')
    return `${list}#${config.colors.arc}|${config.arcWidth}|${config.arcDash}|${config.arcSpeed}`
  }

  private rebuild(arcs: GlobeArc[], config: GlobeConfig) {
    // Descarta os arcos antigos só no fim, para o programa de shader não ser destruído e recompilado a cada troca.
    const previous = this.meshes.splice(0)
    const seen = new Set<string>()
    for (const arc of arcs) {
      if (seen.has(arc.id)) continue
      const curve = this.curveFor(arc)
      if (!curve) continue
      seen.add(arc.id)

      const length = curve.getLength()
      const geometry = new TubeGeometry(curve, Math.max(24, Math.ceil(length * 24)), config.arcWidth, 6, false)
      const [from, to] = this.colorsFor(arc, config)
      const material = new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uColorA: { value: shaderColor(from) },
          uColorB: { value: shaderColor(to) },
          uTime: this.time,
          uDash: { value: config.arcDash },
          uCycles: { value: Math.max(1, length / PERIOD) },
          uSpeed: { value: config.arcSpeed },
          uBase: { value: BASE_ALPHA },
        },
        transparent: true,
        depthWrite: false,
      })
      const mesh = new Mesh(geometry, material)
      mesh.renderOrder = 4
      mesh.raycast = () => {}
      this.group.add(mesh)
      this.meshes.push(mesh)
    }
    this.release(previous)
  }

  private release(meshes: Mesh[]) {
    for (const mesh of meshes) {
      this.group.remove(mesh)
      mesh.geometry.dispose()
      if (mesh.material instanceof ShaderMaterial) mesh.material.dispose()
    }
  }

  private curveFor(arc: GlobeArc) {
    const { from, to } = arc
    if (![from.lat, from.lng, to.lat, to.lng].every(Number.isFinite)) return null

    const a = new Vector3(...latLngToSphere(from.lat, from.lng, 1))
    const b = new Vector3(...latLngToSphere(to.lat, to.lng, 1))
    const angle = a.angleTo(b)
    const fromRadius = GLOBE_RADIUS * (SURFACE + Math.max(0, from.altitude ?? 0))
    const toRadius = GLOBE_RADIUS * (SURFACE + Math.max(0, to.altitude ?? 0))
    const start = a.clone().multiplyScalar(fromRadius)
    const end = b.clone().multiplyScalar(toRadius)
    // Mesmo ponto no chão e no ar (ex.: satélite sobre a estação): ainda existe um arco vertical.
    if (!(angle > 0.001) && start.distanceTo(end) < 0.01) return null

    const peak =
      arc.altitude !== undefined && Number.isFinite(arc.altitude)
        ? Math.max(0, arc.altitude)
        : Math.max(MIN_ALTITUDE, MAX_ALTITUDE * (angle / Math.PI))
    // Pontos opostos: a soma dos vetores é nula, então escolhe um eixo qualquer para subir.
    const middle = a.clone().add(b)
    if (middle.lengthSq() < 1e-8) middle.set(0, 1, 0)
    middle.normalize()
    // O ponto médio de uma curva quadrática é 1/4 do início + 1/2 do controle + 1/4 do fim.
    // Escolhe o controle para esse ponto ficar `peak` acima da altura média das pontas.
    const mid = middle.clone().multiplyScalar((fromRadius + toRadius) / 2 + peak * GLOBE_RADIUS)
    const control = mid.multiplyScalar(2).sub(start.clone().add(end).multiplyScalar(0.5))
    return new QuadraticBezierCurve3(start, control, end)
  }

  private colorsFor(arc: GlobeArc, config: GlobeConfig): [string, string] {
    if (Array.isArray(arc.color)) return arc.color
    const color = arc.color ?? config.colors.arc
    return [color, color]
  }

  private clear() {
    this.release(this.meshes.splice(0))
  }
}

// ShaderMaterial não converte espaço de cor: passa a cor como está escrita no CSS.
function shaderColor(css: string) {
  return new Color(css).convertLinearToSRGB()
}
