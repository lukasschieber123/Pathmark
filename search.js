let _map = null;

export function init(map) {
  _map = map;

  const bar = document.getElementById('search-bar');
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');

  let debounceTimer = null;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (!q) { hideResults(results); return; }
    debounceTimer = setTimeout(() => fetchResults(q, results), 400);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      hideResults(results);
      input.blur();
      e.stopImmediatePropagation();
    }
  });

  document.addEventListener('click', (e) => {
    if (!bar.contains(e.target)) hideResults(results);
  });
}

async function fetchResults(query, resultsEl) {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=en`;
    const res = await fetch(url);
    const data = await res.json();
    const seen = new Set();
    const deduped = data.features.filter(f => {
      const label = buildLabel(f.properties);
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    });
    renderResults(deduped, resultsEl);
  } catch (e) {
    hideResults(resultsEl);
  }
}

function buildLabel(props) {
  return [props.name, props.city, props.state, props.country]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ');
}

function renderResults(data, resultsEl) {
  resultsEl.innerHTML = '';
  if (!data.length) {
    resultsEl.innerHTML = '<div class="search-empty">No results</div>';
    resultsEl.classList.add('show');
    return;
  }
  for (const feature of data) {
    const [lon, lat] = feature.geometry.coordinates;
    const label = buildLabel(feature.properties);
    const div = document.createElement('div');
    div.className = 'search-result';
    div.textContent = label;
    div.addEventListener('click', () => {
      const center = [lon, lat];
      let zoom = 13;
      const ext = feature.properties.extent;
      if (ext) {
        const [w, n, e, s] = ext;
        const cam = _map.cameraForBounds([[w, s], [e, n]], { padding: 40 });
        if (cam) {
          if (cam.zoom >= 7) zoom = Math.max(12, Math.min(cam.zoom, 14));
          else zoom = cam.zoom;
        }
      }
      _map.flyTo({ center, zoom, duration: 1400 });
      document.getElementById('search-input').value = '';
      hideResults(resultsEl);
    });
    resultsEl.appendChild(div);
  }
  resultsEl.classList.add('show');
}

function hideResults(resultsEl) {
  resultsEl.classList.remove('show');
  resultsEl.innerHTML = '';
}
