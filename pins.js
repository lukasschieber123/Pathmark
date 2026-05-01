import { currentTrip } from './state.js';

let map = null;
let pinsEl = null;
let routeLinesEl = null;
let pinItems = [];
let onPinClick = () => {};

export function init(mapInstance, opts = {}) {
  map = mapInstance;
  pinsEl = document.getElementById("pins");
  routeLinesEl = document.getElementById("route-lines");
  if (opts.onPinClick) onPinClick = opts.onPinClick;
}

export function renderPins() {
  if (!pinsEl) return;
  pinsEl.textContent = "";
  pinItems = [];
  const trip = currentTrip();
  if (!trip) return;
  trip.pins.forEach((pin, i) => {
    const el = document.createElement("div");
    el.className = "pin";
    el.innerHTML =
      '<div class="pin-stem"></div>' +
      '<div class="pin-head"><span class="pin-number">' + (i + 1) + '</span></div>';
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onPinClick(pin.id);
    });
    pinsEl.appendChild(el);
    pinItems.push({ el, pin });
  });
  updatePinPositions();
  renderRouteLines();
}

export function updatePinPositions() {
  if (!pinItems.length) return;
  const zoom = map.getZoom();
  const isGlobe = zoom < 5.5;
  const center = map.getCenter();
  const toRad = Math.PI / 180;
  const φc = center.lat * toRad;
  const sinφc = Math.sin(φc);
  const cosφc = Math.cos(φc);
  for (const { el, pin } of pinItems) {
    let visible = true;
    if (isGlobe) {
      const φ = pin.lat * toRad;
      const dλ = (pin.lng - center.lng) * toRad;
      const cosDist = sinφc * Math.sin(φ) + cosφc * Math.cos(φ) * Math.cos(dλ);
      if (cosDist < 0.05) visible = false;
    }
    const px = map.project([pin.lng, pin.lat]);
    if (!isFinite(px.x) || !isFinite(px.y)) {
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      continue;
    }
    el.style.left = px.x + "px";
    el.style.top = px.y + "px";
    el.style.opacity = visible ? "1" : "0";
    el.style.pointerEvents = visible ? "auto" : "none";
  }
}

export function renderRouteLines() {
  if (!routeLinesEl) return;
  for (const child of Array.from(routeLinesEl.children)) {
    if (child.tagName !== "defs") routeLinesEl.removeChild(child);
  }
  const trip = currentTrip();
  if (!trip || trip.pins.length < 2) return;

  const zoom = map.getZoom();
  const isGlobe = zoom < 5.5;
  const center = map.getCenter();
  const toRad = Math.PI / 180;
  const φc = center.lat * toRad;
  const sinφc = Math.sin(φc);
  const cosφc = Math.cos(φc);

  function projectPoint(lng, lat) {
    if (isGlobe) {
      const φ = lat * toRad;
      const dλ = (lng - center.lng) * toRad;
      const cosDist = sinφc * Math.sin(φ) + cosφc * Math.cos(φ) * Math.cos(dλ);
      if (cosDist < 0.05) return null;
    }
    const px = map.project([lng, lat]);
    if (!isFinite(px.x) || !isFinite(px.y)) return null;
    if (Math.abs(px.x) > 50000 || Math.abs(px.y) > 50000) return null;
    return { x: px.x, y: px.y - 23 };
  }

  function greatCirclePath(a, b) {
    const lat1 = a.lat * toRad, lng1 = a.lng * toRad;
    const lat2 = b.lat * toRad, lng2 = b.lng * toRad;
    const x1 = Math.cos(lat1) * Math.cos(lng1);
    const y1 = Math.cos(lat1) * Math.sin(lng1);
    const z1 = Math.sin(lat1);
    const x2 = Math.cos(lat2) * Math.cos(lng2);
    const y2 = Math.cos(lat2) * Math.sin(lng2);
    const z2 = Math.sin(lat2);
    const dot = Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2));
    const omega = Math.acos(dot);
    const sinOmega = Math.sin(omega);
    const n = Math.max(24, Math.min(96, Math.ceil(omega * 180 / Math.PI)));
    const points = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      let lng, lat;
      if (sinOmega < 1e-6) {
        lng = a.lng + (b.lng - a.lng) * t;
        lat = a.lat + (b.lat - a.lat) * t;
      } else {
        const s1 = Math.sin((1 - t) * omega) / sinOmega;
        const s2 = Math.sin(t * omega) / sinOmega;
        const x = s1 * x1 + s2 * x2;
        const y = s1 * y1 + s2 * y2;
        const z = s1 * z1 + s2 * z2;
        lat = Math.asin(z) / toRad;
        lng = Math.atan2(y, x) / toRad;
      }
      points.push({ lng, lat });
    }
    return points;
  }

  const NS = "http://www.w3.org/2000/svg";

  for (let i = 0; i < trip.pins.length - 1; i++) {
    const gc = greatCirclePath(trip.pins[i], trip.pins[i + 1]);
    const screenPoints = gc.map(p => projectPoint(p.lng, p.lat));

    let firstIdx = -1, lastIdx = -1;
    for (let j = 0; j < screenPoints.length; j++) {
      if (screenPoints[j]) {
        if (firstIdx < 0) firstIdx = j;
        lastIdx = j;
      }
    }

    if (firstIdx >= 0 && firstIdx < lastIdx) {
      const A = screenPoints[firstIdx];
      const B = screenPoints[lastIdx];
      const chordX = B.x - A.x;
      const chordY = B.y - A.y;
      const chordLen = Math.sqrt(chordX * chordX + chordY * chordY);
      if (chordLen >= 1) {
        const perpUnitX = -chordY / chordLen;
        const perpUnitY = chordX / chordLen;
        const midIdx = Math.floor((firstIdx + lastIdx) / 2);
        const M = screenPoints[midIdx];
        let dirSign = 0;
        if (M) {
          const cmx = (A.x + B.x) / 2;
          const cmy = (A.y + B.y) / 2;
          const naturalSigned = (M.x - cmx) * perpUnitX + (M.y - cmy) * perpUnitY;
          dirSign = naturalSigned / Math.max(0.5, Math.abs(naturalSigned));
        }
        const extraLift = Math.max(25, chordLen * 0.15);
        const span = lastIdx - firstIdx;
        for (let j = firstIdx + 1; j < lastIdx; j++) {
          const p = screenPoints[j];
          if (!p) continue;
          const t = (j - firstIdx) / span;
          const lift = Math.sin(Math.PI * t) * extraLift * dirSign;
          p.x += perpUnitX * lift;
          p.y += perpUnitY * lift;
        }
      }
    }

    let d = "";
    let lastValid = false;
    for (const s of screenPoints) {
      if (s) {
        d += (lastValid ? "L" : "M") + s.x + " " + s.y + " ";
        lastValid = true;
      } else {
        lastValid = false;
      }
    }
    if (!d) continue;

    const shadow = document.createElementNS(NS, "path");
    shadow.setAttribute("d", d);
    shadow.setAttribute("fill", "none");
    shadow.setAttribute("stroke", "rgba(4,10,28,0.7)");
    shadow.setAttribute("stroke-width", "5");
    shadow.setAttribute("stroke-linecap", "round");
    shadow.setAttribute("stroke-linejoin", "round");
    shadow.setAttribute("filter", "url(#route-shadow)");

    const glow = document.createElementNS(NS, "path");
    glow.setAttribute("d", d);
    glow.setAttribute("fill", "none");
    glow.setAttribute("stroke", "#f59133");
    glow.setAttribute("stroke-width", "7");
    glow.setAttribute("stroke-linecap", "round");
    glow.setAttribute("stroke-linejoin", "round");
    glow.setAttribute("opacity", "0.4");
    glow.setAttribute("filter", "url(#route-glow)");

    const main = document.createElementNS(NS, "path");
    main.setAttribute("d", d);
    main.setAttribute("fill", "none");
    main.setAttribute("stroke", "#f59133");
    main.setAttribute("stroke-width", "3");
    main.setAttribute("stroke-linecap", "round");
    main.setAttribute("stroke-linejoin", "round");

    const g = document.createElementNS(NS, "g");
    g.appendChild(shadow);
    g.appendChild(glow);
    g.appendChild(main);
    routeLinesEl.appendChild(g);
  }
}

export function updateOverlays() {
  updatePinPositions();
  renderRouteLines();
}
