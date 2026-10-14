# vue-globe

Componente Vue 3 de um globo WebGL. Quem consome importa o componente, passa as regiões e recebe hover e clique.

```vue
<script setup>
import { Globe } from 'vue-globe'
import 'vue-globe/style.css'

const regions = [
  {
    id: 'BRA-CE',
    name: 'Ceará',
    parentId: 'BRA',
    fill: '#e1251b',
    geometry: { type: 'Polygon', coordinates: [] },
  },
]
</script>

<template>
  <Globe
    :regions="regions"
    @region-hover="onHover"
    @region-click="onClick"
  />
</template>
```

O elemento pai precisa de largura e altura. `vue` e `three` são dependências do projeto que usa o componente.

## Desenvolvimento

```bash
npm install
npm run dev
```

`npm run build` gera `dist/` para publicar ou ligar com `file:../vue-globe`.
