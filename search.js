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
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    const seen = new Set();
    const deduped = data.sort(sortResults).filter(item => {
      if (seen.has(item.display_name)) return false;
      seen.add(item.display_name);
      return true;
    });
    renderResults(deduped, resultsEl);
  } catch (e) {
    hideResults(resultsEl);
  }
}

function renderResults(data, resultsEl) {
  resultsEl.innerHTML = '';
  if (!data.length) {
    resultsEl.innerHTML = '<div class="search-empty">No results</div>';
    resultsEl.classList.add('show');
    return;
  }
  for (const item of data) {
    const div = document.createElement('div');
    div.className = 'search-result';
    div.textContent = item.display_name;
    div.addEventListener('click', () => {
      const center = [parseFloat(item.lon), parseFloat(item.lat)];
      let zoom = 13;
      if (item.boundingbox) {
        const [s, n, w, e] = item.boundingbox.map(Number);
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


function sortResults(a, b) {
  return (b.importance || 0) - (a.importance || 0);
}

function hideResults(resultsEl) {
  resultsEl.classList.remove('show');
  resultsEl.innerHTML = '';
}
