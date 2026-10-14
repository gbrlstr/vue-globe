import type { Position, Region, RegionGeometry } from '@/types'

export const GLOBE_RADIUS = 2

export function latLngToSphere(lat: number, lng: number, radius: number): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((lng + 180) * Math.PI) / 180
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ]
}

export function sphereToLatLng(x: number, y: number, z: number) {
  const radius = Math.hypot(x, y, z) || 1
  const lat = 90 - (Math.acos(Math.min(1, Math.max(-1, y / radius))) * 180) / Math.PI
  let lng = (Math.atan2(z, -x) * 180) / Math.PI - 180
  while (lng > 180) lng -= 360
  while (lng < -180) lng += 360
  return { lat, lng }
}

export function regionCentroid(region: Region) {
  const ring = outerRing(region.geometry)
  if (!ring?.length) return { lat: 0, lng: 0 }
  let lng = 0
  let lat = 0
  for (const point of ring) {
    lng += point[0]
    lat += point[1]
  }
  return { lng: lng / ring.length, lat: lat / ring.length }
}

export function findRegion(regions: Region[], lng: number, lat: number) {
  let match: Region | null = null
  let area = Infinity
  for (const region of regions) {
    if (!geometryContains(region.geometry, lng, lat)) continue
    const next = geometryArea(region.geometry)
    if (next < area) {
      match = region
      area = next
    }
  }
  return match
}

function outerRing(geometry: RegionGeometry) {
  const polygon = geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates[0]
  return polygon?.[0]
}

function geometryArea(geometry: RegionGeometry) {
  const ring = outerRing(geometry)
  if (!ring?.length) return Infinity
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  for (const [lng, lat] of ring) {
    minLng = Math.min(minLng, lng)
    minLat = Math.min(minLat, lat)
    maxLng = Math.max(maxLng, lng)
    maxLat = Math.max(maxLat, lat)
  }
  return Math.max(maxLng - minLng, 0.01) * Math.max(maxLat - minLat, 0.01)
}

function geometryContains(geometry: RegionGeometry, lng: number, lat: number) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  for (const polygon of polygons) {
    const outer = polygon[0]
    if (!outer || !ringContains(outer, lng, lat)) continue
    const inHole = polygon.slice(1).some((hole) => hole && ringContains(hole, lng, lat))
    if (!inHole) return true
  }
  return false
}

function ringContains(ring: Position[], lng: number, lat: number) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const current = ring[i]
    const previous = ring[j]
    if (!current || !previous) continue
    const xi = current[0]
    const yi = current[1]
    const xj = previous[0]
    const yj = previous[1]
    const crosses = yi > lat !== yj > lat
    if (crosses && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
