First public release with markers, arcs, choropleth regions and a lighter package.

## Highlights
- **Markers** with labels, colors, hover and click, and an optional `altitude` so pins can float with a stem to the ground
- **Animated arcs** with gradients (`arcs` prop)
- **Choropleth maps**: `Region.fill` paints regions, `regionOpacity` controls the blend
- **Zoom** with the mouse wheel and pinch, and smooth camera flights with `focus(id, { duration })`
- **Localized country names** via `config.locale`
- **8 live examples**: https://gbrlstr.github.io/vue-globe/examples/

## Performance and size
- Package went from about 12 MB to 2.1 MB: the map and textures are separate files in `dist/assets` and can come from a CDN (`assets` prop)
- Country borders drawn in one draw call instead of about 2,400, and hover resolved once per frame
- Cloud shader only runs over the ocean, and only when `showClouds` is on

## Install
npm install vue-globe three

Full list of changes in [CHANGELOG.md](./CHANGELOG.md).