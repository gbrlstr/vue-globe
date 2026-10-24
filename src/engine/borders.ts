import { BufferGeometry, Float32BufferAttribute } from 'three'

import { GLOBE_RADIUS, latLngToSphere } from './geo'

export const FILL_TEX_W = 4096
export const FILL_TEX_H = 2048

export interface IndexedFeature {
  code: string
  name: string
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][] | number[][][][]
  bbox: [number, number, number, number]
}

export interface CountryLines {
  code: string
  name: string
  geometries: BufferGeometry[]
}

interface RawFeature {
  properties?: { code?: string; name?: string; iso_3166_2?: string }
  geometry?: { type?: string; coordinates?: number[][][] | number[][][][] }
}

export function buildSphere(radius: number, widthSeg: number, heightSeg: number) {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let row = 0; row <= heightSeg; row++) {
    const v = row / heightSeg
    const lat = 90 - v * 180
    for (let col = 0; col <= widthSeg; col++) {
      const u = col / widthSeg
      const lng = u * 360 - 180
      positions.push(...latLngToSphere(lat, lng, radius))
      uvs.push(u, (lat + 90) / 180)
    }
  }

  for (let row = 0; row < heightSeg; row++) {
    for (let col = 0; col < widthSeg; col++) {
      const a = row * (widthSeg + 1) + col
      const b = a + widthSeg + 1
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export async function indexWorld(data: RawFeature[]) {
  const features: IndexedFeature[] = []
  const groups = new Map<string, CountryLines>()
  const raw = new Map<string, { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] }>()
  const usStateCoords: number[][][][] = []
  const braStateCoords: number[][][][] = []

  for (let i = 0; i < data.length; i++) {
    if (i % 24 === 0) await new Promise((resolve) => setTimeout(resolve, 0))
    const feature = data[i]
    const geometry = feature?.geometry
    let code = feature?.properties?.code
    if (!feature || !geometry?.coordinates || !code) continue
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') continue

    const parentCode = code
    const isUS = parentCode === 'USA'
    const isBRA = parentCode === 'BRA'
    if (isBRA && feature.properties?.iso_3166_2) code = feature.properties.iso_3166_2

    const name = feature.properties?.name ?? code
    const lines =
      geometry.type === 'Polygon'
        ? buildRings(geometry.coordinates as number[][][], GLOBE_RADIUS)
        : (geometry.coordinates as number[][][][]).flatMap((polygon) => buildRings(polygon, GLOBE_RADIUS))

    if (geometry.type === 'Polygon') {
      const coordinates = geometry.coordinates as number[][][]
      features.push({
        code,
        name,
        type: 'Polygon',
        coordinates,
        bbox: computeBBox(coordinates),
      })
      if (isUS) usStateCoords.push(coordinates)
      if (isBRA) braStateCoords.push(coordinates)
      raw.set(code, { type: 'Polygon', coordinates })
    } else {
      const coordinates = geometry.coordinates as number[][][][]
      features.push({
        code,
        name,
        type: 'MultiPolygon',
        coordinates,
        bbox: computeBBox(coordinates.flat()),
      })
      if (isUS) usStateCoords.push(...coordinates)
      if (isBRA) braStateCoords.push(...coordinates)
      raw.set(code, { type: 'MultiPolygon', coordinates })
    }

    const group = groups.get(code) ?? { code, name, geometries: [] }
    group.geometries.push(...lines)
    groups.set(code, group)
  }

  if (usStateCoords.length) raw.set('USA', { type: 'MultiPolygon', coordinates: usStateCoords })
  if (braStateCoords.length) raw.set('BRA', { type: 'MultiPolygon', coordinates: braStateCoords })

  return { features, groups: [...groups.values()], raw }
}

export function buildRings(rings: number[][][], radius: number) {
  const geometries: BufferGeometry[] = []
  const lifted = radius * 1.002

  for (const ring of rings) {
    let current: number[][] = []
    const segments: number[][][] = []
    for (const point of ring) {
      const lng = point[0]
      const lat = point[1]
      if (lng == null || lat == null) continue
      const prev = current[current.length - 1]
      if (prev && Math.abs(lng - prev[0]!) > 180) {
        if (current.length > 1) segments.push(current)
        current = []
      }
      current.push([lng, lat])
    }
    if (current.length > 1) segments.push(current)

    for (const segment of segments) {
      const positions: number[] = []
      for (const point of segment) {
        positions.push(...latLngToSphere(point[1]!, point[0]!, lifted))
      }
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
      geometries.push(geometry)
    }
  }

  return geometries
}

/**
 * Junta várias polilinhas em um só buffer de posições e um índice de segmentos, para desenhar tudo com
 * uma chamada. `counts` diz quantos índices cada polilinha ocupa, na ordem em que entraram.
 */
export function mergePolylines(geometries: BufferGeometry[]) {
  let vertices = 0
  let indices = 0
  for (const geometry of geometries) {
    const count = geometry.getAttribute('position').count
    vertices += count
    indices += Math.max(0, count - 1) * 2
  }
  const position = new Float32Array(vertices * 3)
  const index = new Uint32Array(indices)
  const counts: number[] = []
  let vertex = 0
  let cursor = 0
  for (const geometry of geometries) {
    const attribute = geometry.getAttribute('position')
    const count = attribute.count
    position.set(attribute.array as Float32Array, vertex * 3)
    for (let i = 0; i < count - 1; i++) {
      index[cursor++] = vertex + i
      index[cursor++] = vertex + i + 1
    }
    counts.push(Math.max(0, count - 1) * 2)
    vertex += count
    geometry.dispose()
  }
  return { position, index, counts }
}

export function findFeatureAtLatLng(lat: number, lng: number, features: IndexedFeature[]) {
  for (const feature of features) {
    const [minLng, minLat, maxLng, maxLat] = feature.bbox
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue
    if (feature.type === 'Polygon') {
      const ring = (feature.coordinates as number[][][])[0]
      if (ring && pointInRing(lat, lng, ring)) return feature
    } else {
      for (const polygon of feature.coordinates as number[][][][]) {
        const ring = polygon[0]
        if (ring && pointInRing(lat, lng, ring)) return feature
      }
    }
  }
  return null
}

export function paintGeometry(
  ctx: CanvasRenderingContext2D,
  geometry: { type: string; coordinates: number[][][] | number[][][][] },
  locked: boolean,
  color = '#ffffff',
) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates as number[][][]] : (geometry.coordinates as number[][][][])
  ctx.fillStyle = locked ? stripePattern(ctx) : color

  for (const polygon of polygons) {
    const rawRing = polygon[0]
    if (!rawRing || rawRing.length < 3) continue

    let crossing = -1
    for (let i = 1; i < rawRing.length; i++) {
      const current = rawRing[i]
      const previous = rawRing[i - 1]
      if (!current || !previous) continue
      if (Math.abs(current[0]! - previous[0]!) > 180) {
        crossing = i
        break
      }
    }

    let outer = unwrapRing(rawRing)
    let minLng = Infinity
    let maxLng = -Infinity
    for (const point of outer) {
      if (point[0] < minLng) minLng = point[0]
      if (point[0] > maxLng) maxLng = point[0]
    }
    const lngRange = maxLng - minLng
    const isPolar = lngRange > 300
    let poleY = 0
    if (isPolar && crossing >= 0) {
      outer = unwrapRing([...rawRing.slice(crossing), ...rawRing.slice(0, crossing)])
      const avgLat = outer.reduce((sum, point) => sum + point[1], 0) / outer.length
      const poleLat = avgLat < 0 ? -89.5 : 89.5
      poleY = ((90 - poleLat) / 180) * FILL_TEX_H
    }

    for (const offset of [0, -360, 360]) {
      ctx.beginPath()
      for (let i = 0; i < outer.length; i++) {
        const point = outer[i]
        if (!point) continue
        const x = ((point[0] + offset + 180) / 360) * FILL_TEX_W
        const y = ((90 - Math.max(-89.5, Math.min(89.5, point[1]))) / 180) * FILL_TEX_H
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      if (isPolar) {
        const last = outer[outer.length - 1]
        const first = outer[0]
        if (last && first) {
          ctx.lineTo(((last[0] + offset + 180) / 360) * FILL_TEX_W, poleY)
          ctx.lineTo(((first[0] + offset + 180) / 360) * FILL_TEX_W, poleY)
        }
      }
      ctx.closePath()
      ctx.fill('evenodd')
    }
  }
}

function computeBBox(rings: number[][][]): [number, number, number, number] {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  for (const ring of rings) {
    for (const point of ring) {
      const lng = point[0]
      const lat = point[1]
      if (lng == null || lat == null) continue
      minLng = Math.min(minLng, lng)
      minLat = Math.min(minLat, lat)
      maxLng = Math.max(maxLng, lng)
      maxLat = Math.max(maxLat, lat)
    }
  }
  return [minLng, minLat, maxLng, maxLat]
}

function pointInRing(lat: number, lng: number, ring: number[][]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const current = ring[i]
    const previous = ring[j]
    if (!current || !previous) continue
    const lngI = current[0]!
    const latI = current[1]!
    const lngJ = previous[0]!
    const latJ = previous[1]!
    if (Math.abs(lngI - lngJ) > 180) continue
    const crosses = latI > lat !== latJ > lat
    if (crosses && lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI) inside = !inside
  }
  return inside
}

function unwrapRing(ring: number[][]) {
  const first = ring[0]
  const result: [number, number][] = first ? [[first[0] ?? 0, first[1] ?? 0]] : []
  for (let i = 1; i < ring.length; i++) {
    const point = ring[i]
    if (!point) continue
    let lng = point[0] ?? 0
    const prev = result[i - 1]?.[0] ?? lng
    while (lng - prev > 180) lng -= 360
    while (lng - prev < -180) lng += 360
    result.push([lng, point[1] ?? 0])
  }
  return result
}

let stripes: CanvasPattern | null = null
function stripePattern(ctx: CanvasRenderingContext2D): string | CanvasPattern {
  if (stripes) return stripes
  const size = 12
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const paint = canvas.getContext('2d')
  if (!paint) return '#ffffff'
  paint.strokeStyle = '#1a1a1a'
  paint.lineWidth = 1
  paint.beginPath()
  paint.moveTo(0, size)
  paint.lineTo(size, 0)
  paint.stroke()
  const pattern = ctx.createPattern(canvas, 'repeat')
  if (!pattern) return '#ffffff'
  stripes = pattern
  return pattern
}
