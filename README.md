# vue-globe

[![npm](https://img.shields.io/npm/v/vue-globe.svg)](https://www.npmjs.com/package/vue-globe) [![license](https://img.shields.io/npm/l/vue-globe.svg)](./LICENSE) [![bundle size](https://img.shields.io/bundlephobia/minzip/vue-globe)](https://bundlephobia.com/package/vue-globe)

**An interactive WebGL globe for Vue 3.** Countries you can hover and click, markers, animated arcs, choropleth fills and full theming, in about 16 KB of gzipped JavaScript (three.js is a peer dependency).

🇧🇷 [Leia em português](./README.pt-BR.md)

![A spinning globe with countries, grid and ocean](https://raw.githubusercontent.com/gbrlstr/vue-globe/main/globe.gif)

## Examples

Click an image to open the live example. The source of each one is a single HTML file in [`examples/`](./examples).

<table>
  <tr>
    <td align="center" width="33%">
      <a href="https://gbrlstr.github.io/vue-globe/examples/01-country-explorer/"><img src="https://raw.githubusercontent.com/gbrlstr/vue-globe/main/examples/01-country-explorer/preview.png" alt="Country explorer" width="100%"></a><br>
      <a href="https://gbrlstr.github.io/vue-globe/examples/01-country-explorer/"><b>Country explorer</b></a>
    </td>
    <td align="center" width="33%">
      <a href="https://gbrlstr.github.io/vue-globe/examples/02-brazil-heatmap/"><img src="https://raw.githubusercontent.com/gbrlstr/vue-globe/main/examples/02-brazil-heatmap/preview.png" alt="Brazil heat map" width="100%"></a><br>
      <a href="https://gbrlstr.github.io/vue-globe/examples/02-brazil-heatmap/"><b>Brazil heat map</b></a>
    </td>
    <td align="center" width="33%">
      <a href="https://gbrlstr.github.io/vue-globe/examples/03-flight-routes/"><img src="https://raw.githubusercontent.com/gbrlstr/vue-globe/main/examples/03-flight-routes/preview.png" alt="Flight routes" width="100%"></a><br>
      <a href="https://gbrlstr.github.io/vue-globe/examples/03-flight-routes/"><b>Flight routes</b></a>
    </td>
  </tr>
  <tr>
    <td align="center" width="33%">
      <a href="https://gbrlstr.github.io/vue-globe/examples/04-city-markers/"><img src="https://raw.githubusercontent.com/gbrlstr/vue-globe/main/examples/04-city-markers/preview.png" alt="Cities with markers" width="100%"></a><br>
      <a href="https://gbrlstr.github.io/vue-globe/examples/04-city-markers/"><b>Cities with markers</b></a>
    </td>
    <td align="center" width="33%">
      <a href="https://gbrlstr.github.io/vue-globe/examples/05-themes/"><img src="https://raw.githubusercontent.com/gbrlstr/vue-globe/main/examples/05-themes/preview.png" alt="Themes" width="100%"></a><br>
      <a href="https://gbrlstr.github.io/vue-globe/examples/05-themes/"><b>Themes</b></a>
    </td>
    <td align="center" width="33%">
      <a href="https://gbrlstr.github.io/vue-globe/examples/06-population-heatmap/"><img src="https://raw.githubusercontent.com/gbrlstr/vue-globe/main/examples/06-population-heatmap/preview.png" alt="Population heatmap" width="100%"></a><br>
      <a href="https://gbrlstr.github.io/vue-globe/examples/06-population-heatmap/"><b>Population heatmap</b></a>
    </td>
  </tr>
  <tr>
    <td align="center" width="33%">
      <a href="https://gbrlstr.github.io/vue-globe/examples/07-satellites/"><img src="https://raw.githubusercontent.com/gbrlstr/vue-globe/main/examples/07-satellites/preview.png" alt="Satellites" width="100%"></a><br>
      <a href="https://gbrlstr.github.io/vue-globe/examples/07-satellites/"><b>Satellites</b></a>
    </td>
    <td align="center" width="33%">
      <a href="https://gbrlstr.github.io/vue-globe/examples/08-us-international-outbound/"><img src="https://raw.githubusercontent.com/gbrlstr/vue-globe/main/examples/08-us-international-outbound/preview.png" alt="US international outbound" width="100%"></a><br>
      <a href="https://gbrlstr.github.io/vue-globe/examples/08-us-international-outbound/"><b>US international outbound</b></a>
    </td>
    <td width="33%"></td>
  </tr>
</table>

## Features

- Countries (and Brazilian and US states) drawn from a bundled map, with hover, click and persistent highlight
- Your own regions as GeoJSON polygons, with an optional `fill` color for choropleth maps
- Markers with labels, colors and hover/click events
- Animated arcs with gradients, set by two coordinates
- Camera control from code: `focus`, `highlight`, `clear`
- Country names in any language through `Intl.DisplayNames` (`config.locale`)
- Every color, opacity and layer is configurable at runtime
- Heavy files (map and textures, about 3.3 MB) are separate assets, not inlined in the JavaScript, and can be served from a CDN
- Written in TypeScript, types included

## Install

Requires Vue 3.5+ and three.js 0.184+.

```bash
npm install vue-globe three
```

## Quick start

```vue
<script setup>
import { Globe } from 'vue-globe'
import 'vue-globe/style.css' // required: it makes the canvas fill its parent
</script>

<template>
  <!-- the parent needs a size -->
  <div style="width: 100%; height: 100dvh">
    <Globe @region-click="({ region }) => console.log(region.name)" />
  </div>
</template>
```

### Markers and arcs

```vue
<script setup>
const markers = [
  { id: 'fortaleza', lat: -3.73, lng: -38.52, label: 'Fortaleza' },
  { id: 'lisboa', lat: 38.72, lng: -9.14, label: 'Lisbon', color: '#4ade80' },
]
const arcs = [
  { id: 'for-lis', from: markers[0], to: markers[1], color: ['#ff8a3d', '#ffd23f'] },
]
</script>

<template>
  <Globe :markers="markers" :arcs="arcs" @marker-click="(m) => console.log(m.id)" />
</template>
```

### Choropleth regions

A `Region` with a `fill` color is painted on the globe. Coordinates follow GeoJSON (`[longitude, latitude]`).

```vue
<script setup>
const regions = [
  {
    id: 'area-1',
    name: 'My area',
    fill: '#e1251b',
    data: { route: '/area-1' }, // comes back in the events
    geometry: {
      type: 'Polygon',
      coordinates: [[[-48.5, -1.4], [-48.3, -1.4], [-48.3, -1.2], [-48.5, -1.2], [-48.5, -1.4]]],
    },
  },
]
</script>

<template>
  <Globe :regions="regions" :config="{ regionOpacity: 0.85 }" />
</template>
```

See the [Brazil heat map example](./examples/02-brazil-heatmap) for a full one: it builds 27 regions from the bundled map and colors them by population density.

### Controlling the globe from code

```vue
<script setup>
import { ref } from 'vue'
const globe = ref(null)
</script>

<template>
  <Globe ref="globe" :markers="markers" />
  <button @click="globe.focus('fortaleza')">Go to Fortaleza</button>
  <button @click="globe.highlight('JPN')">Highlight Japan</button>
  <button @click="globe.clear()">Clear</button>
</template>
```

## API

### Props

| Prop | Type | Description |
| --- | --- | --- |
| `regions` | `Region[]` | Extra polygons drawn over the countries. Tested for hover and click before the built-in map. |
| `markers` | `GlobeMarker[]` | Pins on the globe. |
| `arcs` | `GlobeArc[]` | Animated arcs between two coordinates. |
| `config` | `Partial<GlobeConfig>` | Anything you want to change from the defaults. Reactive. |
| `assets` | `GlobeAssets` | Custom URLs for the map and textures. Read once, on mount. |

### Events

| Event | Payload | When |
| --- | --- | --- |
| `ready` | none | Map and textures finished loading. |
| `regionHover` | `{ region, lat, lng }` or `null` | The pointer enters or leaves a region. |
| `regionClick` | `{ region, lat, lng }` | A region is clicked. |
| `pointerMiss` | none | A click lands on the ocean. |
| `markerHover` | `GlobeMarker` or `null` | The pointer enters or leaves a pin. |
| `markerClick` | `GlobeMarker` | A pin is clicked. It does not also fire `regionClick`. |

### Methods (via `ref`)

| Method | What it does |
| --- | --- |
| `focus(id, options?)` | Flies the camera to a country (3-letter code such as `JPN`), one of your regions or a marker. `options`: `{ duration: 900, distance }`. With `duration: 0` the camera jumps. Dragging or zooming cancels the flight. |
| `highlight(id)` | Highlights a country by its 3-letter code. The highlight stays until `highlight(null)` or `clear()`. |
| `clear()` | Removes the selection and the highlight. |

Brazil and the US are drawn state by state in the bundled map, so `focus('BRA')` does not center the whole country. Use a marker or a region of your own for that.

### Types

```ts
interface Region {
  id: string
  name: string
  geometry: PolygonGeometry | MultiPolygonGeometry // GeoJSON, [lng, lat]
  fill?: string // any CSS color. Without it the region only has a border
  border?: string
  locked?: boolean
  data?: unknown
}

interface GlobeMarker {
  id: string; lat: number; lng: number
  label?: string; color?: string
  altitude?: number // in globe radii. With altitude the pin floats and gets a thin stem down to the ground
  data?: unknown
}

interface GlobeArc {
  id: string
  from: { lat: number; lng: number }
  to: { lat: number; lng: number; altitude?: number } // `from` takes altitude too
  color?: string | [string, string] // one color, or [start, end] for a gradient
  altitude?: number // height of the arc's peak, in globe radii. Default grows with the distance
  data?: unknown
}
```

### Config

| Field | Default | Effect |
| --- | --- | --- |
| `autoRotate` | `true` | Spins the camera by itself |
| `rotateSpeed` | `0.12` | Rotation speed, in radians per second |
| `interactive` | `true` | Drag, hover and click |
| `zoom` | `true` | Zoom with the mouse wheel and pinch. The wheel is captured while the pointer is over the globe |
| `minDistance` | `2.8` | Closest the camera can get to the center (the globe has radius 2) |
| `maxDistance` | `12` | Farthest the camera can get |
| `locale` | `'en'` | Language of country names (BCP 47, such as `pt-BR`). Only used for countries without a name in the map |
| `showLines` | `true` | Country borders |
| `showGrid` | `true` | Grid over the ocean |
| `showAtmosphere` | `true` | Halo around the globe |
| `showClouds` | `true` | Clouds over the ocean |
| `showCells` | `true` | Hover cells |
| `showMarkers` | `true` | Shows `markers` |
| `markerSize` | `0.04` | Pin radius (the globe has radius 2) |
| `markerLabels` | `'always'` | `'always'`, `'hover'` or `'never'` |
| `showArcs` | `true` | Shows `arcs` |
| `arcWidth` | `0.008` | Arc tube radius |
| `arcDash` | `0.45` | Lit part of each dash cycle, from 0 to 1. With `1` the arc is a solid line |
| `arcSpeed` | `0.6` | Dash cycles per second. With `0` the arc stays still |
| `regionOpacity` | `0.85` | Opacity of regions that have `fill` |
| `lineOpacity` | `0.55` | Border opacity |
| `fillOpacity` | `0.55` | Hover and selection fill opacity |
| `gridOpacity` | `0.5` | Grid opacity |
| `colors` | see below | Globe colors |
| `camera` | see below | Initial camera |

Colors: `border` `#005696`, `fill` `#e1251b`, `hover` `#ffffff`, `land` `#fefefe`, `ocean` `#214898`, `grid` `#cedff3`, `atmosphere` `#83a6ce`, `background` `#061018`, `marker` `#ffd23f`, `label` `#ffffff`, `labelBackground` `rgba(6, 16, 24, 0.78)`, `arc` `#ff8a3d`.

Camera: `lat` `-18`, `lng` `-58`, `distance` `5.35`, `fov` `40`.

## Map and textures

The country map and the textures (about 3.3 MB together) are not inlined in the library's JavaScript. They ship as files in `dist/assets`, and your bundler (Vite, webpack) copies them and resolves the URLs by itself.

To serve them from somewhere else, such as a CDN, pass `assets`. Every field is optional, and whatever you leave out uses the file from the package.

```vue
<Globe
  :assets="{
    world: 'https://cdn.example.com/globe/world-main.json',
    textures: { color: 'https://cdn.example.com/globe/color_map.webp' }, // sea, specular, bump, normal work the same way
  }"
/>
```

## Notes

- **Server rendering.** The WebGL scene is created in `onMounted`, so on the server only an empty container is rendered. In Nuxt, wrapping the component in `<ClientOnly>` is the safe choice. This has not been tested in a Nuxt project yet.
- **Scale.** Markers and arcs are meant for dozens of items (the satellites example moves about 100 markers at 20 updates per second). Thousands are not optimized yet.
- **Brazil state ids.** In the bundled map, `region.id` for a Brazilian or US state is the country code (`BRA`, `USA`), and the state is in `region.name`. For per-state control, build your own regions as in the heat map example.
- **Map data.** The bundled map is a compacted version of a public world dataset. Check its license before using it commercially.

## Development

```bash
npm install
npm run dev        # playground in src/dev
npm run build      # outputs dist/, including dist/assets
npm run examples   # builds, then serves the repo so you can open examples/
```

## License

MIT. See [LICENSE](./LICENSE).
