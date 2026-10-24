# Examples

Each folder has an `index.html` and a `preview.png`. The pages are plain HTML with an import map: no bundler, no install step beyond building the library. Vue and three.js come from a CDN, and `vue-globe` comes from your local `dist/`.

| Example | Shows |
| --- | --- |
| [01 · Country explorer](./01-country-explorer) | `regionHover`, `regionClick`, `focus()`, `config.locale` |
| [02 · Brazil heat map](./02-brazil-heatmap) | `regions` with `fill`, `regionOpacity`, building regions from the bundled map |
| [03 · Flight routes](./03-flight-routes) | `arcs` with gradients, `arcWidth`, `arcDash`, `arcSpeed`, markers |
| [04 · Cities with markers](./04-city-markers) | `markers`, `markerClick`, `markerLabels`, camera flights |
| [05 · Themes](./05-themes) | `config.colors` swapped at runtime |
| [06 · Population heatmap](./06-population-heatmap) | `regions` with `fill` for 80 countries on a log color scale |
| [07 · Satellites](./07-satellites) | `markers` moving in real time (simulated orbits) |
| [08 · US international outbound](./08-us-international-outbound) | Filled `regions`, hub `markers` and filtered `arcs` together |

Live: <https://gbrlstr.github.io/vue-globe/examples/>

## Run them locally

From the repository root:

```bash
npm install
npm run examples
```

Then open the address it prints, followed by `/examples/01-country-explorer/`. The pages must be served over HTTP: opening the files directly (`file://`) blocks the module imports.

To use an example in your own project, copy its `<script type="module">` block into a component and replace the import map with `import { Globe } from 'vue-globe'`.
