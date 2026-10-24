# vue-globe

[![npm](https://img.shields.io/npm/v/vue-globe.svg)](https://www.npmjs.com/package/vue-globe) [![license](https://img.shields.io/npm/l/vue-globe.svg)](./LICENSE) [![bundle size](https://img.shields.io/bundlephobia/minzip/vue-globe)](https://bundlephobia.com/package/vue-globe)

**Um globo WebGL interativo para Vue 3.** Países com hover e clique, marcadores, arcos animados, mapas de calor e temas, em cerca de 16 KB de JavaScript comprimido (o three.js é dependência peer).

🇺🇸 [Read in English](./README.md)

![Globo girando, com países, grade e oceano](https://raw.githubusercontent.com/gbrlstr/vue-globe/main/globe.gif)

## Exemplos

Clique em uma imagem para abrir o exemplo ao vivo. O código de cada um é um único arquivo HTML em [`examples/`](./examples).

<table>
  <tr>
    <td align="center" width="33%">
      <a href="https://gbrlstr.github.io/vue-globe/examples/01-country-explorer/"><img src="https://raw.githubusercontent.com/gbrlstr/vue-globe/main/examples/01-country-explorer/preview.png" alt="Explorador de países" width="100%"></a><br>
      <a href="https://gbrlstr.github.io/vue-globe/examples/01-country-explorer/"><b>Explorador de países</b></a>
    </td>
    <td align="center" width="33%">
      <a href="https://gbrlstr.github.io/vue-globe/examples/02-brazil-heatmap/"><img src="https://raw.githubusercontent.com/gbrlstr/vue-globe/main/examples/02-brazil-heatmap/preview.png" alt="Mapa de calor do Brasil" width="100%"></a><br>
      <a href="https://gbrlstr.github.io/vue-globe/examples/02-brazil-heatmap/"><b>Mapa de calor do Brasil</b></a>
    </td>
    <td align="center" width="33%">
      <a href="https://gbrlstr.github.io/vue-globe/examples/03-flight-routes/"><img src="https://raw.githubusercontent.com/gbrlstr/vue-globe/main/examples/03-flight-routes/preview.png" alt="Rotas aéreas" width="100%"></a><br>
      <a href="https://gbrlstr.github.io/vue-globe/examples/03-flight-routes/"><b>Rotas aéreas</b></a>
    </td>
  </tr>
  <tr>
    <td align="center" width="33%">
      <a href="https://gbrlstr.github.io/vue-globe/examples/04-city-markers/"><img src="https://raw.githubusercontent.com/gbrlstr/vue-globe/main/examples/04-city-markers/preview.png" alt="Cidades com marcadores" width="100%"></a><br>
      <a href="https://gbrlstr.github.io/vue-globe/examples/04-city-markers/"><b>Cidades com marcadores</b></a>
    </td>
    <td align="center" width="33%">
      <a href="https://gbrlstr.github.io/vue-globe/examples/05-themes/"><img src="https://raw.githubusercontent.com/gbrlstr/vue-globe/main/examples/05-themes/preview.png" alt="Temas" width="100%"></a><br>
      <a href="https://gbrlstr.github.io/vue-globe/examples/05-themes/"><b>Temas</b></a>
    </td>
    <td align="center" width="33%">
      <a href="https://gbrlstr.github.io/vue-globe/examples/06-population-heatmap/"><img src="https://raw.githubusercontent.com/gbrlstr/vue-globe/main/examples/06-population-heatmap/preview.png" alt="Mapa de calor da população" width="100%"></a><br>
      <a href="https://gbrlstr.github.io/vue-globe/examples/06-population-heatmap/"><b>Mapa de calor da população</b></a>
    </td>
  </tr>
  <tr>
    <td align="center" width="33%">
      <a href="https://gbrlstr.github.io/vue-globe/examples/07-satellites/"><img src="https://raw.githubusercontent.com/gbrlstr/vue-globe/main/examples/07-satellites/preview.png" alt="Satélites" width="100%"></a><br>
      <a href="https://gbrlstr.github.io/vue-globe/examples/07-satellites/"><b>Satélites</b></a>
    </td>
    <td align="center" width="33%">
      <a href="https://gbrlstr.github.io/vue-globe/examples/08-us-international-outbound/"><img src="https://raw.githubusercontent.com/gbrlstr/vue-globe/main/examples/08-us-international-outbound/preview.png" alt="Saídas internacionais dos EUA" width="100%"></a><br>
      <a href="https://gbrlstr.github.io/vue-globe/examples/08-us-international-outbound/"><b>Saídas internacionais dos EUA</b></a>
    </td>
    <td width="33%"></td>
  </tr>
</table>

## Recursos

- Países (e estados do Brasil e dos EUA) desenhados a partir de um mapa embutido, com hover, clique e destaque fixo
- Regiões suas, como polígonos GeoJSON, com `fill` opcional para mapas de calor
- Marcadores com rótulo, cor e eventos de hover e clique
- Arcos animados com degradê, definidos por duas coordenadas
- Controle da câmera por código: `focus`, `highlight`, `clear`
- Nomes de países em qualquer idioma via `Intl.DisplayNames` (`config.locale`)
- Cores, opacidades e camadas configuráveis em tempo de execução
- Os arquivos pesados (mapa e texturas, cerca de 3,3 MB) ficam separados do JavaScript e podem vir de um CDN
- Escrito em TypeScript, com tipos incluídos

## Instalação

Precisa de Vue 3.5+ e three.js 0.184+.

```bash
npm install vue-globe three
```

## Começando

```vue
<script setup>
import { Globe } from 'vue-globe'
import 'vue-globe/style.css' // obrigatório: faz o canvas ocupar o elemento pai
</script>

<template>
  <!-- o elemento pai precisa de tamanho -->
  <div style="width: 100%; height: 100dvh">
    <Globe @region-click="({ region }) => console.log(region.name)" />
  </div>
</template>
```

### Marcadores e arcos

```vue
<script setup>
const markers = [
  { id: 'fortaleza', lat: -3.73, lng: -38.52, label: 'Fortaleza' },
  { id: 'lisboa', lat: 38.72, lng: -9.14, label: 'Lisboa', color: '#4ade80' },
]
const arcs = [
  { id: 'for-lis', from: markers[0], to: markers[1], color: ['#ff8a3d', '#ffd23f'] },
]
</script>

<template>
  <Globe :markers="markers" :arcs="arcs" @marker-click="(m) => console.log(m.id)" />
</template>
```

### Regiões com preenchimento

Uma `Region` com cor em `fill` é pintada no globo. As coordenadas seguem o GeoJSON (`[longitude, latitude]`).

```vue
<script setup>
const regions = [
  {
    id: 'area-1',
    name: 'Minha área',
    fill: '#e1251b',
    data: { rota: '/area-1' }, // volta nos eventos
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

O [exemplo do mapa de calor](./examples/02-brazil-heatmap) mostra um caso completo: monta 27 regiões a partir do mapa embutido e colore cada uma pela densidade demográfica.

### Controlar o globo por código

```vue
<script setup>
import { ref } from 'vue'
const globe = ref(null)
</script>

<template>
  <Globe ref="globe" :markers="markers" />
  <button @click="globe.focus('fortaleza')">Ir para Fortaleza</button>
  <button @click="globe.highlight('JPN')">Destacar o Japão</button>
  <button @click="globe.clear()">Limpar</button>
</template>
```

## API

### Props

| Prop | Tipo | Descrição |
| --- | --- | --- |
| `regions` | `Region[]` | Polígonos extras por cima dos países. O hover e o clique testam essas regiões antes do mapa embutido. |
| `markers` | `GlobeMarker[]` | Pinos no globo. |
| `arcs` | `GlobeArc[]` | Arcos animados entre duas coordenadas. |
| `config` | `Partial<GlobeConfig>` | O que você quiser mudar do padrão. Reativo. |
| `assets` | `GlobeAssets` | URLs próprias para o mapa e as texturas. Lido uma vez, na montagem. |

### Eventos

| Evento | Valor | Quando |
| --- | --- | --- |
| `ready` | nenhum | Mapa e texturas terminaram de carregar. |
| `regionHover` | `{ region, lat, lng }` ou `null` | O ponteiro entra ou sai de uma região. |
| `regionClick` | `{ region, lat, lng }` | Clique em uma região. |
| `pointerMiss` | nenhum | Clique no oceano. |
| `markerHover` | `GlobeMarker` ou `null` | O ponteiro entra ou sai de um pino. |
| `markerClick` | `GlobeMarker` | Clique em um pino. Não dispara `regionClick` junto. |

### Métodos (via `ref`)

| Método | O que faz |
| --- | --- |
| `focus(id, options?)` | Leva a câmera até um país (código de 3 letras, como `JPN`), uma região sua ou um marcador. `options`: `{ duration: 900, distance }`. Com `duration: 0` a câmera salta. Arrastar ou dar zoom cancela o voo. |
| `highlight(id)` | Destaca um país pelo código de 3 letras. O destaque fica até `highlight(null)` ou `clear()`. |
| `clear()` | Remove a seleção e o destaque. |

O Brasil e os EUA são desenhados estado por estado no mapa embutido, então `focus('BRA')` não centraliza o país inteiro. Para isso, use um marcador ou uma região sua.

### Tipos

```ts
interface Region {
  id: string
  name: string
  geometry: PolygonGeometry | MultiPolygonGeometry // GeoJSON, [lng, lat]
  fill?: string // qualquer cor CSS. Sem ela, a região só tem borda
  border?: string
  locked?: boolean
  data?: unknown
}

interface GlobeMarker {
  id: string; lat: number; lng: number
  label?: string; color?: string
  altitude?: number // em raios do globo. Com altura o pino flutua e ganha uma haste até o chão
  data?: unknown
}

interface GlobeArc {
  id: string
  from: { lat: number; lng: number }
  to: { lat: number; lng: number; altitude?: number } // `from` também aceita altitude
  color?: string | [string, string] // uma cor, ou [início, fim] para degradê
  altitude?: number // altura do ponto mais alto do arco, em raios do globo. Por padrão cresce com a distância
  data?: unknown
}
```

### Configuração

| Campo | Padrão | Efeito |
| --- | --- | --- |
| `autoRotate` | `true` | Gira a câmera sozinha |
| `rotateSpeed` | `0.12` | Velocidade da rotação, em radianos por segundo |
| `interactive` | `true` | Arrastar, hover e clique |
| `zoom` | `true` | Zoom com a roda do mouse e pinça. A roda fica presa ao globo enquanto o ponteiro está sobre ele |
| `minDistance` | `2.8` | Mais perto que a câmera chega do centro (o globo tem raio 2) |
| `maxDistance` | `12` | Mais longe que a câmera chega |
| `locale` | `'en'` | Idioma dos nomes de país (BCP 47, como `pt-BR`). Só vale para países sem nome no mapa |
| `showLines` | `true` | Bordas dos países |
| `showGrid` | `true` | Grade sobre o oceano |
| `showAtmosphere` | `true` | Halo em volta do globo |
| `showClouds` | `true` | Nuvens no oceano |
| `showCells` | `true` | Células de hover |
| `showMarkers` | `true` | Mostra os `markers` |
| `markerSize` | `0.04` | Raio do pino (o globo tem raio 2) |
| `markerLabels` | `'always'` | `'always'`, `'hover'` ou `'never'` |
| `showArcs` | `true` | Mostra os `arcs` |
| `arcWidth` | `0.008` | Raio do tubo do arco |
| `arcDash` | `0.45` | Parte acesa de cada ciclo, de 0 a 1. Com `1` o arco é uma linha contínua |
| `arcSpeed` | `0.6` | Ciclos de traço por segundo. Com `0` o arco fica parado |
| `regionOpacity` | `0.85` | Opacidade das regiões com `fill` |
| `lineOpacity` | `0.55` | Opacidade das bordas |
| `fillOpacity` | `0.55` | Opacidade do preenchimento de hover e seleção |
| `gridOpacity` | `0.5` | Opacidade da grade |
| `colors` | ver abaixo | Cores do globo |
| `camera` | ver abaixo | Câmera inicial |

Cores: `border` `#005696`, `fill` `#e1251b`, `hover` `#ffffff`, `land` `#fefefe`, `ocean` `#214898`, `grid` `#cedff3`, `atmosphere` `#83a6ce`, `background` `#061018`, `marker` `#ffd23f`, `label` `#ffffff`, `labelBackground` `rgba(6, 16, 24, 0.78)`, `arc` `#ff8a3d`.

Câmera: `lat` `-18`, `lng` `-58`, `distance` `5.35`, `fov` `40`.

## Mapa e texturas

O mapa dos países e as texturas (cerca de 3,3 MB no total) não ficam dentro do JavaScript da biblioteca. Vêm como arquivos em `dist/assets`, e o bundler do seu projeto (Vite, webpack) copia esses arquivos e resolve as URLs sozinho.

Para servir de outro lugar, como um CDN, passe `assets`. Todos os campos são opcionais, e o que faltar usa o arquivo do pacote.

```vue
<Globe
  :assets="{
    world: 'https://cdn.exemplo.com/globe/world-main.json',
    textures: { color: 'https://cdn.exemplo.com/globe/color_map.webp' }, // sea, specular, bump e normal seguem o mesmo padrão
  }"
/>
```

## Observações

- **Renderização no servidor.** A cena WebGL é criada em `onMounted`, então no servidor só sai um contêiner vazio. No Nuxt, envolver o componente em `<ClientOnly>` é o caminho seguro. Ainda não foi testado em um projeto Nuxt.
- **Escala.** Marcadores e arcos foram pensados para dezenas de itens. Milhares ainda não foram otimizados.
- **Ids dos estados.** No mapa embutido, o `region.id` de um estado do Brasil ou dos EUA é o código do país (`BRA`, `USA`), e o estado fica em `region.name`. Para controlar cada estado, monte regiões próprias, como no exemplo do mapa de calor.
- **Dados do mapa.** O mapa embutido é uma versão compactada de um conjunto de dados público. Confira a licença antes de usar comercialmente.

## Desenvolvimento

```bash
npm install
npm run dev        # playground em src/dev
npm run build      # gera dist/, incluindo dist/assets
npm run examples   # faz o build e serve o repositório para abrir examples/
```

## Licença

MIT. Veja o arquivo [LICENSE](./LICENSE).
