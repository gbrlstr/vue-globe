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
  /** Cor de preenchimento da região (qualquer cor CSS). Sem ela, a região só tem borda. */
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
  /** Altura acima da superfície, em raios do globo (0,1 = 10% do raio). Com altura, o pino ganha uma haste até o chão. */
  altitude?: number
  data?: unknown
}

export interface LatLng {
  lat: number
  lng: number
  /** Altura acima da superfície, em raios do globo. Para ligar, por exemplo, um satélite a uma estação no chão. */
  altitude?: number
}

export interface GlobeArc {
  id: string
  from: LatLng
  to: LatLng
  /** Uma cor, ou `[cor do início, cor do fim]` para um degradê. Sem ela, usa `config.colors.arc`. */
  color?: string | [string, string]
  /** Altura do ponto mais alto do arco, em raios do globo. Sem ela, cresce com a distância entre as pontas. */
  altitude?: number
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
  arc: string
}

export type MarkerLabelMode = 'always' | 'hover' | 'never'

export interface FocusOptions {
  /** Duração do voo da câmera, em milissegundos. Com 0 a câmera salta direto. Padrão: 900. */
  duration?: number
  /** Distância da câmera ao final do voo. Sem ela, mantém a atual. */
  distance?: number
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
  /** Zoom com a roda do mouse e o gesto de pinça. */
  zoom: boolean
  /** Distância mínima da câmera ao centro do globo (o globo tem raio 2). */
  minDistance: number
  /** Distância máxima da câmera ao centro do globo. */
  maxDistance: number
  /** Idioma dos nomes de país (código BCP 47, como `pt-BR`). Só vale para países sem nome no mapa. */
  locale: string
  showLines: boolean
  showGrid: boolean
  showAtmosphere: boolean
  showClouds: boolean
  showCells: boolean
  showMarkers: boolean
  /** Raio do pino. O globo tem raio 2. */
  markerSize: number
  markerLabels: MarkerLabelMode
  showArcs: boolean
  /** Raio do tubo do arco. O globo tem raio 2. */
  arcWidth: number
  /** Parte de cada ciclo que fica acesa, de 0 a 1. Com 1 o arco é uma linha contínua. */
  arcDash: number
  /** Ciclos de traço por segundo. Com 0 o arco fica parado. */
  arcSpeed: number
  /** Opacidade do preenchimento das regiões com `fill`. */
  regionOpacity: number
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
  zoom: true,
  minDistance: 2.8,
  maxDistance: 12,
  locale: 'en',
  showLines: true,
  showGrid: true,
  showAtmosphere: true,
  showClouds: true,
  showCells: true,
  showMarkers: true,
  markerSize: 0.04,
  markerLabels: 'always',
  showArcs: true,
  arcWidth: 0.008,
  arcDash: 0.45,
  arcSpeed: 0.6,
  regionOpacity: 0.85,
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
    arc: '#ff8a3d',
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
