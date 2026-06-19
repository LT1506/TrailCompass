// storage.js
// Tiny localStorage helper for settings (e.g. a manual declination override).
// Declination caching lives in declination.js; this is for user preferences.

const SETTINGS_KEY = 'trailcompass.settings';

const DEFAULT_SETTINGS = {
  manualDeclination: null, // number of degrees, or null = "auto from GPS"
};

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return Object.assign({}, DEFAULT_SETTINGS, saved);
  } catch (e) {
    return Object.assign({}, DEFAULT_SETTINGS);
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    /* not fatal */
  }
}

// --- Waypoint (the dropped "start point" for back-tracking) ---
// Saved separately so it survives a reload or crash mid-hike: your way home is
// not lost if the app restarts on the trail.
var WAYPOINT_KEY = 'trailcompass.waypoint';

function saveWaypoint(wp) {
  try {
    localStorage.setItem(WAYPOINT_KEY, JSON.stringify(wp));
  } catch (e) {
    /* not fatal */
  }
}

function loadWaypoint() {
  try {
    return JSON.parse(localStorage.getItem(WAYPOINT_KEY) || 'null');
  } catch (e) {
    return null;
  }
}

function clearWaypoint() {
  try {
    localStorage.removeItem(WAYPOINT_KEY);
  } catch (e) {
    /* not fatal */
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadSettings,
    saveSettings,
    DEFAULT_SETTINGS,
    saveWaypoint,
    loadWaypoint,
    clearWaypoint,
  };
}
