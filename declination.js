// declination.js
// Figures out the magnetic declination (the gap between magnetic north and
// true north) for your location, so the compass can show TRUE heading.
//
// v1 approach (honest note): instead of embedding the full offline World
// Magnetic Model now, we ask NOAA's free geomagnetism service for your local
// declination once we have a GPS fix, then CACHE the answer in localStorage so
// it keeps working offline for the rest of the hike. Declination changes very
// slowly with distance (a fraction of a degree over many miles), so one fix at
// the trailhead is plenty. A fully-offline embedded model is a planned upgrade.
//
// There is also a manual override (Setup) as a fallback if the network fails
// and we have no cached value.

const DECLINATION_CACHE_KEY = 'trailcompass.declination';

// Round so we don't re-fetch for every tiny GPS wiggle. ~0.1 deg lat/lon is
// roughly 11 km — well within the distance declination stays effectively flat.
function cacheKeyFor(lat, lon) {
  return `${lat.toFixed(1)},${lon.toFixed(1)}`;
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(DECLINATION_CACHE_KEY) || 'null');
  } catch (e) {
    return null;
  }
}

function writeCache(entry) {
  try {
    localStorage.setItem(DECLINATION_CACHE_KEY, JSON.stringify(entry));
  } catch (e) {
    /* storage full or blocked — not fatal, we just won't cache */
  }
}

// Returns a Promise that resolves to { value, source } where source is one of
// 'network' | 'cache' | 'none'. Never rejects — callers always get a usable
// answer (falling back to magnetic mode upstream if value is null).
async function getDeclination(lat, lon) {
  const wantKey = cacheKeyFor(lat, lon);
  const cached = readCache();

  // NOAA NCEI declination calculator (WMM). resultFormat=json keeps it tiny.
  const url =
    'https://www.ngdc.noaa.gov/geomag-web/calculators/calculateDeclination' +
    `?lat1=${lat}&lon1=${lon}&resultFormat=json`;

  try {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) {
      const data = await res.json();
      const value = data.result[0].declination; // degrees, east-positive
      const entry = { key: wantKey, value, ts: Date.now() };
      writeCache(entry);
      return { value, source: 'network' };
    }
  } catch (e) {
    /* offline or blocked — fall through to cache */
  }

  if (cached && typeof cached.value === 'number') {
    return { value: cached.value, source: 'cache' };
  }
  return { value: null, source: 'none' };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getDeclination, cacheKeyFor };
}
