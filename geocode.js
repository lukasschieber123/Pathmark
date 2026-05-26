function clean(s) {
  if (!s) return '';
  return s.replace(/^(Municipality|City|Town|District|Prefecture|Region) of\s+/i, '').trim();
}

function dist(a, lat, lng) {
  return Math.hypot(a.lat - lat, a.lon - lng);
}

export async function reverseName(lng, lat) {
  // Overpass: find all cities and towns within 50km, then pick the nearest major city
  try {
    const query =
      '[out:json][timeout:6];' +
      '(node["place"~"^(city|town)$"](around:50000,' + lat + ',' + lng + '););out;';
    const res = await fetch(
      'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query)
    );
    if (res.ok) {
      const elements = (await res.json()).elements || [];

      // Nearest city within 40km (~0.36 deg lat) takes priority
      const cities = elements
        .filter(n => n.tags.place === 'city')
        .sort((a, b) => dist(a, lat, lng) - dist(b, lat, lng));

      if (cities.length && dist(cities[0], lat, lng) < 0.4) {
        return cities[0].tags['name:en'] || cities[0].tags.name || '';
      }

      // No major city nearby — return nearest town
      const nearest = elements.sort((a, b) => dist(a, lat, lng) - dist(b, lat, lng));
      if (nearest.length) {
        return nearest[0].tags['name:en'] || nearest[0].tags.name || '';
      }
    }
  } catch (e) {}

  // Fallback: Nominatim
  try {
    const res = await fetch(
      'https://nominatim.openstreetmap.org/reverse?format=json&accept-language=en&zoom=10&lat=' + lat + '&lon=' + lng
    );
    if (!res.ok) return '';
    const a = (await res.json()).address || {};
    return clean(a.city || a.town || a.village || a.municipality || a.county || '');
  } catch (e) {
    return '';
  }
}
