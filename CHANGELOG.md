# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 0.1.1

### Fixed
- Updating `markers`, `arcs` or `regions` repeatedly (animated maps, live data) no longer recompiles WebGL shaders on every update: materials are now released only after the new ones exist. In a software-rendered test an update went from about 1.5 s to about 80 ms.
- Changing only `Region.fill` repaints the fill texture and keeps the border lines instead of rebuilding them.
- Filling regions that do not cross the antimeridian no longer draws two extra copies of each polygon.

## 0.1.0

### Added
- `markers` prop with labels, colors, hover and click events (`markerHover`, `markerClick`).
- `arcs` prop: animated arcs with gradients between two coordinates.
- `Region.fill`: regions can now be painted, which enables choropleth maps (`regionOpacity` controls the opacity).
- `config.locale`: country names in any language through `Intl.DisplayNames`.
- `assets` prop: serve the map and textures from your own URLs or a CDN.
- `focus()` accepts marker ids; `highlight()` and `clear()` methods.
- Zoom with the mouse wheel and pinch (`zoom`, `minDistance`, `maxDistance`). Drags rotate less when the camera is close.
- `focus(id, { duration, distance })` flies the camera smoothly instead of jumping.
- `altitude` on markers (floating pins with a stem to the ground) and on arcs (peak height and elevated endpoints).
- `examples/` with live demos and a GitHub Pages workflow.

### Changed
- The map and textures ship as separate files in `dist/assets` instead of being inlined in the JavaScript. The package went from about 12 MB to 2.1 MB.
- Country borders are drawn in one draw call instead of about 2,400, and hover is resolved once per frame. Dragging no longer pays for hit testing.
- The cloud shader only runs over the ocean, and only when `showClouds` is on.
- The render resolution lowers itself when frames take too long.

### Fixed
- Pins no longer float past the edge of the globe.
- `highlight()` is no longer erased when the pointer moves.
