export type Position = [number, number] | [number, number, number]

export interface PolygonGeometry {
  type: 'Polygon'
  coordinates: Position[][]
}

export interface MultiPolygonGeometry {
  type: 'MultiPolygon'
  coordinates: Position[][][]
}

export type RegionGeometry = PolygonGeometry | MultiPolygonGeometry

export interface Region {
  id: string
  name: string
  parentId?: string
  geometry: RegionGeometry
  fill?: string
  border?: string
  locked?: boolean
  data?: unknown
}

export interface RegionPointerEvent {
  region: Region
  lat: number
  lng: number
}

export interface GlobeMarker {
  id: string
  lat: number
  lng: number
  label?: string
  data?: unknown
}

export interface GlobeColors {
  border: string
  fill: string
  hover: string
  land: string
  ocean: string
  grid: string
  atmosphere: string
  background: string
}

export interface GlobeCamera {
  lat: number
  lng: number
  distance: number
  fov: number
}

export interface GlobeConfig {
  autoRotate: boolean
  rotateSpeed: number
  interactive: boolean
  showLines: boolean
  showGrid: boolean
  showAtmosphere: boolean
  showClouds: boolean
  showCells: boolean
  lineOpacity: number
  fillOpacity: number
  gridOpacity: number
  colors: GlobeColors
  camera: GlobeCamera
}

export const defaultConfig: GlobeConfig = {
  autoRotate: true,
  rotateSpeed: 0.12,
  interactive: true,
  showLines: true,
  showGrid: true,
  showAtmosphere: true,
  showClouds: true,
  showCells: true,
  lineOpacity: 0.55,
  fillOpacity: 0.55,
  gridOpacity: 0.5,
  colors: {
    border: '#005696',
    fill: '#e1251b',
    hover: '#ffffff',
    land: '#fefefe',
    ocean: '#214898',
    grid: '#cedff3',
    atmosphere: '#83a6ce',
    background: '#061018',
  },
  camera: {
    lat: -18,
    lng: -58,
    distance: 5.35,
    fov: 40,
  },
}

export function resolveConfig(partial?: Partial<GlobeConfig>): GlobeConfig {
  return {
    ...defaultConfig,
    ...partial,
    colors: { ...defaultConfig.colors, ...partial?.colors },
    camera: { ...defaultConfig.camera, ...partial?.camera },
  }
}
