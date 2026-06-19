// geo.js
// PURE GPS geometry. No DOM, no browser APIs — node-testable like compass.js.
// Everything here is "given two points on Earth, what's the direction and
// distance between them," plus formatting distance in US units.

var EARTH_RADIUS_M = 6371000; // mean Earth radius in meters
var DEG = Math.PI / 180;

// Great-circle distance between two lat/long points, in METERS (haversine).
function distanceMeters(lat1, lon1, lat2, lon2) {
  var dLat = (lat2 - lat1) * DEG;
  var dLon = (lon2 - lon1) * DEG;
  var p1 = lat1 * DEG;
  var p2 = lat2 * DEG;
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

// Initial compass bearing (0..360, clockwise from north) to travel FROM point 1
// TO point 2 along the shortest path. This is the "direction to the target."
function bearingTo(lat1, lon1, lat2, lon2) {
  var p1 = lat1 * DEG;
  var p2 = lat2 * DEG;
  var dLon = (lon2 - lon1) * DEG;
  var y = Math.sin(dLon) * Math.cos(p2);
  var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
  var deg = Math.atan2(y, x) / DEG;
  return ((deg % 360) + 360) % 360;
}

// Human-friendly US distance: feet when close, miles when far.
// Under 1000 ft -> whole feet; otherwise miles to 2 decimals.
function formatDistanceUS(meters) {
  var feet = meters * 3.28084;
  if (feet < 1000) {
    return Math.round(feet) + ' ft';
  }
  var miles = meters / 1609.344;
  return miles.toFixed(2) + ' mi';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { distanceMeters, bearingTo, formatDistanceUS, EARTH_RADIUS_M };
}
