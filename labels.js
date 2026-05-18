let map = null;
let labelsEl = null;
let placeSource = null;
let labelFrame = null;

const MAX_LABELS = 90;

// Two-tier abbreviations: short (zoom < 3) and medium (zoom 3–4.5).
// At zoom ≥ 4.5 the full name is always used.
const ABBR_SHORT = {
  "Democratic Republic of the Congo": "DRC",
  "Central African Republic":         "CAR",
  "United States of America":         "USA",
  "United States":                    "USA",
  "United Kingdom":                   "UK",
  "United Arab Emirates":             "UAE",
  "Papua New Guinea":                 "PNG",
  "Bosnia and Herzegovina":           "Bosnia",
  "Republic of the Congo":            "Congo",
  "Equatorial Guinea":                "Eq. Guinea",
  "Trinidad and Tobago":              "Trinidad",
  "Federated States of Micronesia":   "Micronesia",
  "Dominican Republic":               "Dom. Rep.",
  "Solomon Islands":                  "Solomon Is.",
  "Marshall Islands":                 "Marshall Is.",
  "South Sudan":                      "S. Sudan",
  "North Macedonia":                  "N. Macedonia",
  "Western Sahara":                   "W. Sahara",
  "São Tomé and Príncipe":            "São Tomé",
  "Antigua and Barbuda":              "Antigua",
  "Saint Kitts and Nevis":            "St. Kitts",
  "Saint Vincent and the Grenadines": "St. Vincent",
};

const ABBR_MED = {
  "Democratic Republic of the Congo": "DR Congo",
  "Central African Republic":         "C.A.R.",
  "Federated States of Micronesia":   "Micronesia",
  "Bosnia and Herzegovina":           "Bosnia-Herz.",
  "Trinidad and Tobago":              "Trinidad",
  "Solomon Islands":                  "Solomon Is.",
  "Marshall Islands":                 "Marshall Is.",
  "Republic of the Congo":            "Congo",
  "Saint Vincent and the Grenadines": "St. Vincent",
};

function countryDisplayName(name, zoom) {
  if (zoom < 3)   return ABBR_SHORT[name] ?? name;
  if (zoom < 4.5) return ABBR_MED[name] ?? ABBR_SHORT[name] ?? name;
  return name;
}

export function init(mapInstance) {
  map = mapInstance;
  labelsEl = document.getElementById("labels");
}

export function setPlaceSource(source) {
  if (!placeSource) placeSource = source;
}

export function getPlaceSource() {
  return placeSource;
}

export function scheduleLabels() {
  if (labelFrame !== null) return;
  labelFrame = requestAnimationFrame(() => {
    labelFrame = null;
    renderLabels();
  });
}

function maxRankFor(cls, zoom) {
  if (cls === "country") {
    if (zoom < 1.9) return -1;
    if (zoom < 2.6) return 2;
    if (zoom < 3.6) return 4;
    return 99;
  }
  if (cls === "city") {
    if (zoom < 3.0) return -1;
    if (zoom < 4.0) return 2;
    if (zoom < 5.0) return 5;
    if (zoom < 6.0) return 8;
    return 99;
  }
  if (cls === "town") {
    if (zoom < 6.5) return -1;
    if (zoom < 8.0) return 5;
    return 99;
  }
  return -1;
}

function renderLabels() {
  if (!placeSource || !map || !labelsEl) return;
  const zoom = map.getZoom();

  let features;
  try {
    features = map.querySourceFeatures(placeSource, { sourceLayer: "place" });
  } catch (e) {
    return;
  }

  const w = window.innerWidth, h = window.innerHeight;
  const seen = new Map();

  const center = map.getCenter();
  const toRad = Math.PI / 180;
  const φc = center.lat * toRad;
  const sinφc = Math.sin(φc);
  const cosφc = Math.cos(φc);
  const centerLng = center.lng;
  const isGlobe = zoom < 5.5;

  for (const f of features) {
    const props = f.properties || {};
    const cls = props.class;
    const maxRank = maxRankFor(cls, zoom);
    if (maxRank < 0) continue;
    const rank = props.rank || 99;
    if (rank > maxRank) continue;
    const name = props.name_en || props.name;
    if (!name) continue;
    const g = f.geometry;
    if (!g || g.type !== "Point") continue;
    const [lng, lat] = g.coordinates;

    if (isGlobe) {
      const φ = lat * toRad;
      const dλ = (lng - centerLng) * toRad;
      const cosDist = sinφc * Math.sin(φ) + cosφc * Math.cos(φ) * Math.cos(dλ);
      if (cosDist < 0.05) continue;
    }

    const px = map.project([lng, lat]);
    if (!isFinite(px.x) || !isFinite(px.y)) continue;
    if (px.x < -120 || px.x > w + 120) continue;
    if (px.y < -60 || px.y > h + 60) continue;
    const key = name + "|" + cls;
    if (seen.has(key)) continue;
    const label = cls === "country" ? countryDisplayName(name, zoom) : name;
    seen.set(key, { name: label, cls, x: px.x, y: px.y, rank });
  }

  const classOrder = { city: 0, town: 1, country: 2 };
  const candidates = [...seen.values()].sort((a, b) => {
    const co = (classOrder[a.cls] ?? 9) - (classOrder[b.cls] ?? 9);
    if (co !== 0) return co;
    return a.rank - b.rank;
  }).slice(0, MAX_LABELS);

  const placed = [];
  const visible = [];
  for (const item of candidates) {
    const fontSize = item.cls === "country" ? 12 : item.cls === "city" ? 11 : 10;
    const widthPx = item.name.length * fontSize * 0.6 + 6;
    const heightPx = fontSize * 1.4;
    const x1 = item.x - widthPx / 2;
    const x2 = item.x + widthPx / 2;
    const y1 = item.y - heightPx / 2;
    const y2 = item.y + heightPx / 2;

    let collides = false;
    for (const r of placed) {
      if (x1 < r.x2 && x2 > r.x1 && y1 < r.y2 && y2 > r.y1) {
        collides = true;
        break;
      }
    }
    if (collides) continue;
    placed.push({ x1, y1, x2, y2 });
    visible.push(item);
  }

  const frag = document.createDocumentFragment();
  for (const item of visible) {
    const div = document.createElement("div");
    div.className = "label label-" + item.cls;
    div.textContent = item.name;
    div.style.left = item.x + "px";
    div.style.top = item.y + "px";
    frag.appendChild(div);
  }
  labelsEl.textContent = "";
  labelsEl.appendChild(frag);
}
