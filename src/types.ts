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

export interface GlobeMarker {
  id: string
  lat: number
  lng: number
  label?: string
  data?: unknown
}

export interface GlobeTheme {
  fill: string
  hover: string
  border: string
  borderOpacity: number
  fillOpacity: number
  ocean: string
  land: string
}

export const defaultTheme: GlobeTheme = {
  fill: '#e1251b',
  hover: '#ffffff',
  border: '#005696',
  borderOpacity: 0.5,
  fillOpacity: 0.55,
  ocean: '#07111f',
  land: '#16324f',
}
