import {
  WATER, LAND, BORDER, COASTLINE, STREET, RIVER, LABEL, LABEL_HALO
} from './constants.js';
import { currentTrip, addPin, updatePin, setListeners } from './state.js';
import { reverseName } from './geocode.js';
import * as labels from './labels.js';
import * as pins from './pins.js';
import * as menu from './menu.js';
import * as panel from './panel.js';
import * as search from './search.js';
import * as help from './help.js';
import * as timeline from './timeline.js';

const map = new maplibregl.Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/dark",
  center: [0, 20],
  zoom: 1.3,
  projection: { type: "globe" },
  maxTileCacheSize: 1500,
  fadeDuration: 150,
});

labels.init(map);
pins.init(map, { onPinClick: handlePinClick });
search.init(map);
help.init();

document.getElementById('timeline-btn').addEventListener('click', () => {
  if (!timeline.isTimelineOpen()) timeline.openTimeline();
});
panel.setMoveCallback(startMoveMode);

setListeners({
  renderAll,
  renderMenu: menu.renderMenu,
  renderPins: pins.renderPins,
  closePanel: panel.closePanel,
  closeMenu: menu.closeMenu,
});

map.on("style.load", () => {
  try { map.setProjection({ type: "globe" }); } catch (e) { console.warn("setProjection failed:", e); }

  try {
    const styleSources = map.getStyle().sources || {};
    for (const sourceId of Object.keys(styleSources)) {
      const src = map.getSource(sourceId);
      if (src && typeof src.setPrefetchZoomDelta === "function") {
        src.setPrefetchZoomDelta(2);
      }
    }
  } catch (e) { console.warn("prefetch setup failed:", e); }

  const styleLayers = map.getStyle().layers || [];

  let waterSource = null;
  let boundarySource = null;
  let firstSymbolId = null;
  for (const layer of styleLayers) {
    if (!waterSource && layer["source-layer"] === "water" && layer.type === "fill") {
      waterSource = layer.source;
    }
    if (!boundarySource && layer["source-layer"] === "boundary" && layer.type === "line") {
      boundarySource = layer.source;
    }
    if (!firstSymbolId && layer.type === "symbol") {
      firstSymbolId = layer.id;
    }
  }

  for (const layer of styleLayers) {
    const id = layer.id;
    const srcLayer = layer["source-layer"] || "";
    const type = layer.type;

    if (type === "background") {
      map.setPaintProperty(id, "background-color", LAND);
      continue;
    }

    if (type === "fill") {
      if (srcLayer === "water") {
        map.setPaintProperty(id, "fill-color", WATER);
      } else if (
        srcLayer === "landcover" || srcLayer === "landuse" ||
        srcLayer === "park" || srcLayer === "wood"
      ) {
        map.setPaintProperty(id, "fill-color", LAND);
        map.setPaintProperty(id, "fill-opacity", 1.0);
      } else if (srcLayer === "building") {
        map.setPaintProperty(id, "fill-color", "#1e3560");
        map.setPaintProperty(id, "fill-opacity", 0.6);
      }
      continue;
    }

    if (type === "line") {
      if (srcLayer === "water") {
        // Hide any native ocean-outline layers — stroking the ocean polygon
        // produces a pole circle at ~85°N and antimeridian seam lines as
        // tile-edge artifacts. We rely on fill contrast for coastline visibility.
        try { map.setLayoutProperty(id, "visibility", "none"); } catch (e) {}
        continue;
      }
      if (srcLayer === "waterway") {
        try { map.setPaintProperty(id, "line-color", RIVER); } catch (e) {}
        try { map.setPaintProperty(id, "line-opacity", 0.7); } catch (e) {}
        continue;
      }
      if (srcLayer === "transportation" || srcLayer === "transportation_name") {
        try { map.setPaintProperty(id, "line-color", STREET); } catch (e) {}
        try { map.setPaintProperty(id, "line-opacity", 0.55); } catch (e) {}

        const lid = id.toLowerCase();
        let mz = -1;
        let widthExpr = null;
        if (lid.includes("motorway")) {
          if (lid.includes("subtle")) {
            mz = 9;
            widthExpr = ["interpolate", ["linear"], ["zoom"], 9, 0.4, 14, 0.9, 18, 1.4];
          } else {
            mz = 6;
            widthExpr = ["interpolate", ["linear"], ["zoom"], 6, 0.7, 10, 1.2, 14, 1.9, 18, 2.8];
          }
        } else if (lid.includes("highway_major")) {
          mz = 8;
          widthExpr = ["interpolate", ["linear"], ["zoom"], 8, 0.5, 12, 1.0, 16, 1.5, 18, 2.1];
        } else if (lid.includes("highway_minor")) {
          mz = 13;
          widthExpr = ["interpolate", ["linear"], ["zoom"], 13, 0.5, 16, 1.0, 18, 1.5];
        } else if (lid.includes("highway_path")) {
          mz = 15;
          widthExpr = ["interpolate", ["linear"], ["zoom"], 15, 0.4, 18, 0.7];
        } else if (lid.includes("railway")) {
          mz = 7;
          widthExpr = ["interpolate", ["linear"], ["zoom"], 7, 0.4, 12, 0.7, 18, 1.1];
        } else if (lid.includes("pier")) {
          mz = 14;
          widthExpr = ["interpolate", ["linear"], ["zoom"], 14, 0.4, 18, 0.8];
        }
        if (mz > 0) {
          try {
            const existingMax = (typeof layer.maxzoom === "number") ? layer.maxzoom : 24;
            map.setLayerZoomRange(id, mz, existingMax);
          } catch (e) {}
        }
        if (widthExpr) {
          try { map.setPaintProperty(id, "line-width", widthExpr); } catch (e) {}
        }
        continue;
      }
      if (srcLayer === "boundary") {
        try {
          map.setFilter(id, [
            "all",
            ["==", ["get", "admin_level"], 2],
            ["!=", ["get", "maritime"], 1],
          ]);
        } catch (e) {}
        map.setPaintProperty(id, "line-color", BORDER);
        // Belt-and-suspenders: even if the filter above lets a non-2 feature
        // through (e.g. string vs integer admin_level in some tile datasets),
        // the case expression ensures it gets opacity 0.
        map.setPaintProperty(id, "line-opacity", [
          "case",
          ["==", ["get", "admin_level"], 2], 1.0,
          0
        ]);
        map.setPaintProperty(id, "line-width", [
          "interpolate", ["linear"], ["zoom"],
          0, 0.8,
          5, 1.3,
          10, 1.6,
        ]);
        try { map.setPaintProperty(id, "line-dasharray", [1, 0]); } catch (e) {}
      }
      continue;
    }

    if (type === "symbol") {
      if (srcLayer === "place") {
        labels.setPlaceSource(layer.source);
        map.setLayoutProperty(id, "visibility", "none");
        continue;
      }
      if (
        srcLayer === "transportation" || srcLayer === "transportation_name" ||
        srcLayer === "waterway" || srcLayer === "water_name"
      ) {
        map.setLayoutProperty(id, "visibility", "none");
        continue;
      }

      try { map.setPaintProperty(id, "text-color", LABEL); } catch (e) {}
      try { map.setPaintProperty(id, "text-halo-color", LABEL_HALO); } catch (e) {}
      try { map.setPaintProperty(id, "text-halo-width", 1.5); } catch (e) {}
    }
  }

  if (waterSource && !map.getLayer("coastline-stroke")) {
    map.addLayer({
      id: "coastline-stroke",
      type: "line",
      source: waterSource,
      "source-layer": "water",
      filter: [
        "all",
        ["!=", ["get", "intermittent"], 1],
        ["==", ["get", "class"], "ocean"],
      ],
      paint: {
        "line-color": COASTLINE,
        "line-opacity": 0.9,
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          0, 0.5,
          4, 0.8,
          8, 1.2,
          12, 1.6,
        ],
      },
    }, firstSymbolId || undefined);
  }

  if (waterSource && !map.getLayer("inland-water-stroke")) {
    map.addLayer({
      id: "inland-water-stroke",
      type: "line",
      source: waterSource,
      "source-layer": "water",
      filter: [
        "all",
        ["!=", ["get", "intermittent"], 1],
        ["!=", ["get", "class"], "ocean"],
      ],
      paint: {
        "line-color": RIVER,
        "line-opacity": 0.75,
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          4, 0.4,
          8, 0.8,
          12, 1.2,
        ],
      },
    }, firstSymbolId || undefined);
  }

  if (boundarySource && !map.getLayer("state-border")) {
    map.addLayer({
      id: "state-border",
      type: "line",
      source: boundarySource,
      "source-layer": "boundary",
      minzoom: 3,
      filter: [
        "all",
        ["==", ["get", "admin_level"], 4],
        ["!=", ["get", "maritime"], 1],
      ],
      paint: {
        "line-color": BORDER,
        "line-opacity": [
          "interpolate", ["linear"], ["zoom"],
          3, 0,
          4, 0.35,
          6, 0.55,
          10, 0.65,
        ],
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          3, 0.3,
          5, 0.55,
          8, 0.85,
          12, 1.0,
        ],
      },
    }, firstSymbolId || undefined);
  }

  labels.scheduleLabels();
});

map.on("move", labels.scheduleLabels);
map.on("zoom", labels.scheduleLabels);
map.on("idle", labels.scheduleLabels);
map.on("sourcedata", (e) => {
  const src = labels.getPlaceSource();
  if (src && e.sourceId === src && e.isSourceLoaded) labels.scheduleLabels();
});
window.addEventListener("resize", labels.scheduleLabels);

map.on("error", (e) => {
  console.warn("MapLibre error:", e && e.error ? e.error : e);
});

const loaderEl = document.getElementById("loader");
map.on("dataloading", () => loaderEl.classList.add("show"));
map.on("idle", () => loaderEl.classList.remove("show"));

const toastEl = document.getElementById("toast");
let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
}
function toastPersist(msg) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.add("show");
}
function toastClear() {
  clearTimeout(toastTimer);
  toastEl.classList.remove("show");
}

const mapEl = document.getElementById("map");
let movingPinId = null;

function handlePinClick(pinId) {
  if (movingPinId) return;
  panel.openPanel(pinId);
}

function startMoveMode(pinId) {
  movingPinId = pinId;
  pins.setMovingPin(pinId);
  mapEl.style.cursor = "crosshair";
  toastPersist("Double-click anywhere on the map to place the pin — Esc to cancel");
}

map.doubleClickZoom.disable();
map.on("dblclick", (e) => {
  if (movingPinId) {
    const id = movingPinId;
    updatePin(id, { lng: e.lngLat.lng, lat: e.lngLat.lat });
    movingPinId = null;
    pins.setMovingPin(null);
    mapEl.style.cursor = "";
    toastClear();
    pins.renderPins();
    panel.openPanel(id);
    reverseName(e.lngLat.lng, e.lngLat.lat).then(name => {
      if (!name) return;
      updatePin(id, { name });
      pins.renderPins();
      if (panel.isPanelOpen() && panel.getOpenPinId() === id) panel.renderPanel();
      timeline.renderTimeline();
    });
    return;
  }
  if (!currentTrip()) {
    toast("Create a trip first");
    return;
  }
  const pin = addPin(e.lngLat.lng, e.lngLat.lat);
  if (pin) {
    panel.openPanel(pin.id);
    reverseName(e.lngLat.lng, e.lngLat.lat).then(name => {
      if (!name) return;
      const trip = currentTrip();
      const p = trip && trip.pins.find(pp => pp.id === pin.id);
      if (p && !p.name) {
        updatePin(pin.id, { name });
        pins.renderPins();
        if (panel.isPanelOpen() && panel.getOpenPinId() === pin.id) panel.renderPanel();
        timeline.renderTimeline();
      }
    });
  }
});

map.on("move", pins.updateOverlays);
map.on("zoom", pins.updateOverlays);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (timeline.isTimelineOpen()) { timeline.closeTimeline(); return; }
    if (movingPinId) {
      const id = movingPinId;
      movingPinId = null;
      pins.setMovingPin(null);
      mapEl.style.cursor = "";
      toastClear();
      panel.openPanel(id);
    } else if (panel.isPanelOpen()) panel.closePanel();
    else if (menu.isMenuOpen()) {
      menu.closeMenu();
      menu.renderMenu();
    }
  }
});

const compassBtn = document.getElementById('compass-btn');
const compassSvg = document.getElementById('compass-svg');
function updateCompass() {
  compassSvg.style.transform = `rotate(${-map.getBearing()}deg)`;
}
map.on('rotate', updateCompass);
compassBtn.addEventListener('click', () => map.easeTo({ bearing: 0, pitch: 0 }));

function renderAll() {
  menu.renderMenu();
  pins.renderPins();
  if (panel.isPanelOpen()) {
    const trip = currentTrip();
    if (trip && trip.pins.find(p => p.id === panel.getOpenPinId())) {
      panel.renderPanel();
    } else {
      panel.closePanel();
    }
  }
}

menu.renderMenu();
pins.renderPins();
