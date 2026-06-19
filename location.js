// location.js
// Thin wrapper around the browser's GPS. In v1 we only need ONE fix (to look up
// declination). Phase C will switch to watchPosition() for live lat/long, but
// the interface here is built so that drops in without touching callers.

// getFix() resolves to { lat, lon, alt, accuracy } or rejects with an Error.
function getFix() {
  return new Promise(function (resolve, reject) {
    if (!('geolocation' in navigator)) {
      reject(new Error('no-geolocation'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          alt: pos.coords.altitude, // may be null
          accuracy: pos.coords.accuracy, // meters
        });
      },
      function (err) {
        reject(err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

// watch(onFix, onError) streams position updates continuously (for live
// back-track distance/bearing). Calls onFix({lat,lon,alt,accuracy}) on each
// reading. Returns a stop() function that cancels the watch.
function watch(onFix, onError) {
  if (!('geolocation' in navigator)) {
    if (onError) onError(new Error('no-geolocation'));
    return function stop() {};
  }
  var id = navigator.geolocation.watchPosition(
    function (pos) {
      onFix({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        alt: pos.coords.altitude,
        accuracy: pos.coords.accuracy,
      });
    },
    function (err) {
      if (onError) onError(err);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
  );
  return function stop() {
    navigator.geolocation.clearWatch(id);
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getFix, watch };
}
