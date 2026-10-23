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
  /** Cor do pino. Sem ela, usa `config.colors.marker`. */
  color?: string
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
  marker: string
  label: string
  labelBackground: string
}

export type MarkerLabelMode = 'always' | 'hover' | 'never'

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
  showMarkers: boolean
  /** Raio do pino. O globo tem raio 2. */
  markerSize: number
  markerLabels: MarkerLabelMode
  lineOpacity: number
  fillOpacity: number
  gridOpacity: number
  colors: GlobeColors
  camera: GlobeCamera
}

export interface GlobeTextureUrls {
  color: string
  sea: string
  specular: string
  bump: string
  normal: string
}

/**
 * URLs dos arquivos pesados do globo (mapa e texturas). Tudo é opcional: o que
 * não for informado usa o arquivo que vem no pacote. Lido uma vez, na montagem.
 */
export interface GlobeAssets {
  /** GeoJSON dos países, no formato do `world-main.json` do pacote. */
  world?: string
  textures?: Partial<GlobeTextureUrls>
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
  showMarkers: true,
  markerSize: 0.04,
  markerLabels: 'always',
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
    marker: '#ffd23f',
    label: '#ffffff',
    labelBackground: 'rgba(6, 16, 24, 0.78)',
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
