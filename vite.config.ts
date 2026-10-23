import { cpSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

const srcAssets = fileURLToPath(new URL('./src/assets', import.meta.url))
const distAssets = fileURLToPath(new URL('./dist/assets', import.meta.url))

// O Vite embute todo asset em base64 no modo biblioteca (36 MB de JS). Este plugin troca os
// marcadores de view.ts por `new URL("./assets/...", import.meta.url).href` depois do bundle
// e copia src/assets para dist/assets. Quem consome o pacote tem o bundler dele resolvendo
// essa URL, e o mapa e as texturas viram arquivos separados.
function externalAssets(): Plugin {
  return {
    name: 'vue-globe:external-assets',
    apply: 'build',
    renderChunk(code) {
      return code.replace(
        /(["'])__VUE_GLOBE_ASSET__([^"']+)\1/g,
        (_match, _quote, file: string) => `new URL("./assets/${file}", import.meta.url).href`,
      )
    },
    closeBundle() {
      cpSync(srcAssets, distAssets, { recursive: true })
    },
  }
}

export default defineConfig({
  plugins: [
    vue(),
    externalAssets(),
    dts({
      tsconfigPath: './tsconfig.app.json',
      exclude: ['src/dev'],
      insertTypesEntry: true,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'VueGlobe',
      formats: ['es'],
      fileName: 'vue-globe',
    },
    rollupOptions: {
      external: ['vue', 'three'],
    },
  },
})
