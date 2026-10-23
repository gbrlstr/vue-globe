# vue-globe

![Globo girando, com países, grade e oceano](https://raw.githubusercontent.com/gbrlstr/vue-globe/main/globe.gif)

Componente Vue 3 de um globo WebGL. O projeto que consome importa o componente, passa as regiões e decide o que fazer com hover e clique.

## Como usar

### 1. Instalar

O projeto precisa de Vue 3.5 ou mais recente. `three` entra junto com o componente.

```bash
npm install vue-globe three
```

### 2. Importar o componente e o CSS

```vue
<script setup>
import { Globe } from 'vue-globe'
import 'vue-globe/style.css'
</script>
```

O CSS é obrigatório. Sem ele o canvas não ocupa o elemento pai.

### 3. Dar largura e altura ao pai

O globo preenche o elemento em que está. Esse elemento precisa de tamanho.

```css
.mapa {
  width: 100%;
  height: 100dvh;
}
```

### 4. Colocar o globo na página

Países e estados já vêm no componente. `config` é opcional: passe só o que quiser mudar.

```vue
<template>
  <div class="mapa">
    <Globe :config="config" @region-click="onClick" />
  </div>
</template>

<script setup>
import { Globe } from 'vue-globe'
import 'vue-globe/style.css'

const config = {
  autoRotate: true,
  colors: {
    border: '#005696',
    fill: '#e1251b',
    ocean: '#214898',
  },
  camera: { lat: -18, lng: -58, distance: 5.35 },
}
</script>
```

### 5. Tratar o clique

O globo marca a região e entrega o evento. Navegação, painel ou qualquer outra ação ficam no seu projeto.

```vue
<script setup>
function onClick({ region, lat, lng }) {
  // region.id, region.name e region.data
  // lat e lng do ponto clicado
  console.log(region.name, lat, lng)
}
</script>

<template>
  <Globe @region-click="onClick" />
</template>
```

`@region-hover` recebe o mesmo objeto, ou `null` quando o ponteiro sai da região. `@pointer-miss` dispara ao clicar no oceano, fora de qualquer região.

```vue
<Globe
  @region-hover="onHover"
  @region-click="onClick"
  @pointer-miss="onMiss"
/>
```

### 6. Adicionar regiões próprias

`:regions` desenha polígonos extras por cima dos países. O clique testa essas regiões primeiro. As coordenadas seguem GeoJSON: `[longitude, latitude]`.

`data` volta no evento do clique, para você guardar o que o seu app precisa.

```vue
<script setup>
const regions = [
  {
    id: 'area-1',
    name: 'Área customizada',
    fill: '#e1251b',
    data: { rota: '/area-1' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-48.5, -1.4],
          [-48.3, -1.4],
          [-48.3, -1.2],
          [-48.5, -1.2],
          [-48.5, -1.4],
        ],
      ],
    },
  },
]

function onClick({ region }) {
  console.log(region.data)
}
</script>

<template>
  <Globe :regions="regions" @region-click="onClick" />
</template>
```

### 7. Marcadores

`:markers` coloca pinos no globo. Cada marcador precisa de `id`, `lat` e `lng`. `label` mostra um rótulo, `color` troca a cor do pino e `data` volta nos eventos.

```vue
<script setup>
const markers = [
  { id: 'fortaleza', lat: -3.73, lng: -38.52, label: 'Fortaleza', data: { rota: '/fortaleza' } },
  { id: 'lisboa', lat: 38.72, lng: -9.14, label: 'Lisboa', color: '#4ade80' },
]

function onMarkerClick(marker) {
  console.log(marker.id, marker.data)
}

function onMarkerHover(marker) {
  // marker, ou null quando o ponteiro sai do pino
}
</script>

<template>
  <Globe :markers="markers" @marker-click="onMarkerClick" @marker-hover="onMarkerHover" />
</template>
```

- Clicar em um pino dispara só `@marker-click`, não `@region-click`.
- Pinos do outro lado do globo somem junto com o rótulo e não recebem clique.
- Se dois marcadores tiverem o mesmo `id`, vale o primeiro.
- O rótulo é sempre texto puro, nunca HTML.
- `markerLabels` controla os rótulos: `'always'` (padrão), `'hover'` ou `'never'`.
- Pensado para dezenas de pontos. Milhares ainda não foram otimizados.

### 8. Controlar o globo por código

Pegue o componente com `ref` e chame os métodos:

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

| Método | O que faz |
| --- | --- |
| `focus(id)` | Gira a câmera para um país (código de 3 letras, como `JPN`), uma região sua (`id` de `:regions`) ou um marcador (`id` de `:markers`) |
| `highlight(id)` | Destaca um país pelo código de 3 letras. O destaque fica fixo, e passar o ponteiro por outras regiões não o apaga. `highlight(null)` remove |
| `clear()` | Remove a seleção e o destaque |

O Brasil e os EUA são desenhados estado por estado no mapa embutido, então `focus('BRA')` e `focus('USA')` não centralizam o país inteiro. Para isso, use o `id` de um marcador ou de uma região sua.

## O que dá para configurar

| Campo | Padrão | Efeito |
| --- | --- | --- |
| `autoRotate` | `true` | Gira a câmera sozinha |
| `rotateSpeed` | `0.12` | Velocidade da rotação, em radianos por segundo |
| `interactive` | `true` | Arrastar, hover e clique |
| `showLines` | `true` | Bordas dos países |
| `showGrid` | `true` | Grade sobre o oceano |
| `showAtmosphere` | `true` | Halo em volta do globo |
| `showClouds` | `true` | Nuvens no oceano |
| `showCells` | `true` | Células de hover |
| `showMarkers` | `true` | Mostra os marcadores de `:markers` |
| `markerSize` | `0.04` | Raio do pino (o globo tem raio 2) |
| `markerLabels` | `'always'` | Rótulos dos marcadores: `'always'`, `'hover'` ou `'never'` |
| `lineOpacity` | `0.55` | Opacidade das bordas |
| `fillOpacity` | `0.55` | Opacidade do preenchimento |
| `gridOpacity` | `0.5` | Opacidade da grade |
| `colors` | ver abaixo | Cores do globo |
| `camera` | ver abaixo | Posição inicial da câmera |

Cores: `border` `#005696`, `fill` `#e1251b`, `hover` `#ffffff`, `land` `#fefefe`, `ocean` `#214898`, `grid` `#cedff3`, `atmosphere` `#83a6ce`, `background` `#061018`, `marker` `#ffd23f`, `label` `#ffffff`, `labelBackground` `rgba(6, 16, 24, 0.78)`.

Câmera: `lat` `-18`, `lng` `-58`, `distance` `5.35`, `fov` `40`.

## Mapa e texturas

O mapa dos países e as texturas do globo (cerca de 3,3 MB no total) não ficam dentro do JavaScript da biblioteca. Eles vêm como arquivos em `dist/assets`, e o bundler do seu projeto (Vite, webpack) copia esses arquivos para a build e resolve as URLs sozinho. Não precisa configurar nada.

Para servir esses arquivos de outro lugar, como um CDN, passe `assets`. Tudo é opcional: o que você não informar usa o arquivo do pacote. O valor é lido uma vez, quando o componente monta.

```vue
<script setup>
const assets = {
  world: 'https://cdn.exemplo.com/globe/world-main.json',
  textures: {
    color: 'https://cdn.exemplo.com/globe/color_map.webp',
    // sea, specular, bump e normal seguem o mesmo padrão
  },
}
</script>

<template>
  <Globe :assets="assets" />
</template>
```

## Desenvolvimento

```bash
npm install
npm run dev
```

`npm run build` gera `dist/` (incluindo `dist/assets`) para publicar ou ligar com `file:../vue-globe`.

No `npm run dev`, o app de teste em `src/dev` informa os arquivos de `src/assets` pela prop `assets`. O componente sozinho só encontra os arquivos padrão depois do build.

## Licença

MIT. Veja o arquivo [LICENSE](./LICENSE).
