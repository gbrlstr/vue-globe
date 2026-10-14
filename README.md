# vue-globe

Componente Vue 3 de um globo WebGL. Quem consome importa o componente, passa as regiões e recebe hover e clique.

```vue
<script setup>
import { Globe } from 'vue-globe'
import 'vue-globe/style.css'

const config = {
  autoRotate: true,
  rotateSpeed: 0.12,
  showLines: true,
  showGrid: true,
  showAtmosphere: true,
  showClouds: true,
  interactive: true,
  colors: {
    border: '#005696',
    fill: '#e1251b',
    ocean: '#214898',
    land: '#fefefe',
    background: '#061018',
  },
  camera: { lat: -18, lng: -58, distance: 5.35 },
}
</script>

<template>
  <Globe :config="config" @region-hover="onHover" @region-click="onClick" />
</template>
```

Passe só o que quiser mudar. O restante usa o padrão do componente. O elemento pai precisa de largura e altura. `vue` e `three` são dependências do projeto que usa o componente.

## Desenvolvimento

```bash
npm install
npm run dev
```

`npm run build` gera `dist/` para publicar ou ligar com `file:../vue-globe`.
