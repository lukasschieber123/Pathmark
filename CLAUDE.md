# CLAUDE.md

Travel Globe — a single-page MapLibre GL JS globe (OpenFreeMap dark, globe projection) for plotting trips as numbered orange pins connected by glowing great-circle flight-path arcs.

## File map

- `index.html` — HTML skeleton + all CSS. Loads `maplibre-gl.js` (classic) then `main.js` (`type="module"`). No inline JS.
- `constants.js` — color palette (`WATER`, `LAND`, `BORDER`, `COASTLINE`, `STREET`, `RIVER`, `LABEL`, `LABEL_HALO`) and `STORAGE_KEY`. No imports. No DOM, no map.
- `state.js` — `state` object + persistence + trip/pin mutators (`createTrip`, `deleteTrip`, `renameTrip`, `setCurrentTrip`, `addPin`, `deletePin`, `updatePin`, etc.) and `setListeners`. Imports `constants.js` only. **Never touches DOM or map.** Mutators call registered listeners (`renderAll`, `renderMenu`, `renderPins`, `closePanel`, `closeMenu`) wired by `main.js`.
- `modal.js` — `showModal`, `customConfirm`, `customPrompt`, `escapeHtml`, `escapeAttr`. Owns `#modal-overlay`. No other-module imports. Promise-based; replaces native `confirm`/`prompt`.
- `labels.js` — custom DOM-rendered place labels. Exports `init(map)`, `scheduleLabels`, `setPlaceSource`, `getPlaceSource`. Owns `#labels` div, `placeSource`, `labelFrame`, `MAX_LABELS`, `renderLabels`, `maxRankFor`. Never touches pins/menu/panel.
- `pins.js` — pin DOM (`#pins`) and route SVG (`#route-lines`). Exports `init(map, { onPinClick })`, `renderPins`, `updatePinPositions`, `renderRouteLines`, `updateOverlays`. Imports `state.js` only. Pin click invokes `onPinClick(pinId)` callback (wired to `panel.openPanel` in `main.js`). **Never touches menu, panel, modal, or labels.**
- `menu.js` — trip menu (`#menu`). Exports `renderMenu`, `closeMenu`, `isMenuOpen`. Imports `state.js`, `modal.js`. No map reference.
- `panel.js` — pin detail panel (`#panel`). Exports `openPanel`, `closePanel`, `renderPanel`, `isPanelOpen`, `getOpenPinId`. Imports `state.js`, `modal.js`.
- `main.js` — entry point. **Only file that touches MapLibre init, the `style.load` handler, and toast/loader DOM.** Creates the map, calls `labels.init(map)` and `pins.init(map, { onPinClick: panel.openPanel })`, registers state listeners, wires every `map.on(...)` handler, registers the global `Escape` keydown, defines `renderAll`, fires initial `renderMenu()`/`renderPins()`.

Dependency order: `constants` → `state`, `modal`, `labels` → `pins`, `menu`, `panel` → `main`. No cycles.

## Key patterns

- **Pins are NOT MapLibre Markers.** Each pin is an absolute-positioned `<div>` inside `#pins`; `pins.updatePinPositions()` calls `map.project([lng, lat])` on every `move`/`zoom` and writes `left`/`top` directly. Behind-globe culling uses a `cosDist < 0.05` check. The pin's stem-tip lands on the projected pixel; head center is 23 px above.
- **Route lines are SVG paths inside `#route-lines`.** Each segment between consecutive pins is a polyline of up to 96 great-circle samples (slerp on the unit sphere), each projected via `map.project()` then lifted 23 px upward to align with the pin head. To keep arcs visible at zoom-in (where natural projected curvature is geometrically tiny), an *extra* perpendicular lift is added — but only as much as needed to reach a target arc height of `max(12, chord × 0.07)`. The boost is `max(0, target − naturalMag)`, applied with `sin(π·t)` profile in the natural-curvature direction. At globe zoom, the boost is also scaled by `min(1, naturalMag / 15)` — a confidence factor that drops to 0 as the camera approaches the angle where the great-circle projects flat, preventing an abrupt curve flip when panning across that angle. Three layered paths per segment (shadow / glow / main) build the floating effect.
- **Modals replace native dialogs.** `showModal({ message, hasInput, ... })` returns a Promise. `customConfirm` resolves boolean; `customPrompt` resolves string-or-null. Esc/Enter handled with capture-phase `keydown` + `stopImmediatePropagation` so the global Esc handler doesn't also fire.
- **State persistence:** `localStorage` key `travel-globe-trips`, JSON shape `{ trips: [{ id, name, pins: [{ id, lng, lat, name, dateStart, dateEnd, flights, hotels, notes }] }], currentTripId }`.
- **State→render decoupling:** `state.js` exports pure mutators that call registered listener callbacks. `main.js` registers `renderAll`, `renderMenu`, `renderPins`, `closePanel`, `closeMenu`. This keeps `state.js` DOM-free.

## Gotchas

- `labels.init(map)` and `pins.init(map, { onPinClick })` **must run before any render call** — they capture the map reference and grab their DOM elements.
- The `style.load` handler in `main.js` finds the place vector source while iterating layers and calls `labels.setPlaceSource(layer.source)` — without this, labels never render.
- Route lines are **already implemented** (great-circle arcs with shadow + glow + main layers, perpendicular-lift exaggeration). Old handoff notes call route lines "deferred" — that's stale; do not re-implement.
- `pins.renderPins()` early-returns when there's no current trip and does NOT clear `#route-lines`. Stale lines remain until the next `move`/`zoom` triggers `updateOverlays`. Preserved deliberately to match prior behavior.
- ES modules **do not** load from `file://` in Chrome (CORS-blocked). The app is launched via `TravelGlobe.app` on the Desktop (an AppleScript bundle exported via Script Editor from `launcher.applescript` in this repo). It starts `python3 -m http.server 8765 --directory /Users/lukasschieber/Repos/travel-globe` in the background and opens Chrome in app mode at `http://localhost:8765/`. The server stays running between launches; `pkill -f "http.server 8765"` to stop it.
- Unicode identifiers (`φc`, `sinφc`, `cosφc`, `dλ`, `φ`) appear in pins.js, labels.js — do not "fix" to ASCII; they make the spherical math readable and match prior code.
- `setCurrentTrip` calls both `closePanel()` and `closeMenu()` listeners — `closeMenu` only flips the flag; the subsequent `renderAll` re-renders the now-collapsed menu.

## Current feature status

**Working:**
- Pin placement (click globe, custom-positioned divs)
- Trip system (create / switch / rename / delete via custom modals)
- Route lines (great-circle arcs, glow + shadow, zoom-adaptive curvature with smooth flip-zone handling)
- State borders (admin_level 4 layer)
- Loading indicator (orange pulsing dot, bottom-left)
- Custom DOM-rendered place labels with collision avoidance
- Detail panel (right-side, name / dateStart+dateEnd pickers / flights / hotels / notes; shows "X days here" + "X days to next stop" computed below pickers)
- Persistence to `localStorage`

**Deferred:**
- Pin side-list inside the trip menu
- "Clear all pins" button on the current trip
- State border visual verification (code shipped but not yet QA'd at zoom 4–6 over USA/Germany/etc.)
