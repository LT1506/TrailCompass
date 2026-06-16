// compass.js
// PURE MATH ONLY. No DOM, no browser APIs in here.
// Everything in this file is a plain function of its inputs, so it can be
// unit-tested with `node tests.js`. Keeping the math separate from the
// screen is what let RangeHUD move to the glasses cleanly, so we do it here too.

// Bring any angle into the range [0, 360).
// Example: normalize360(-10) -> 350,  normalize360(370) -> 10.
function normalize360(deg) {
  return ((deg % 360) + 360) % 360;
}

// The smallest signed angle to turn from heading `a` to heading `b`.
// Result is in (-180, 180]. Negative = target is to your LEFT, positive = RIGHT.
// (Not shown on screen in v1, but phase C "follow a bearing" needs it, and it's
//  cheap to test now while the math is fresh.)
function angularDifference(a, b) {
  return normalize360(b - a + 180) - 180;
}

// Turn a heading in degrees into a 16-point compass name like "NW" or "ENE".
const POINTS_16 = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];
function cardinal(deg) {
  // 360 / 16 = 22.5 degrees per slice. Add half a slice so the boundaries
  // land in the middle of each name (337.5..22.5 -> "N").
  const idx = Math.round(normalize360(deg) / 22.5) % 16;
  return POINTS_16[idx];
}

// Convert a MAGNETIC heading (what the sensor gives) to a TRUE heading
// (what a map / GPS uses) by adding the magnetic declination for your location.
// Declination is EAST-positive: in most of the western US it's positive, in the
// eastern US it's negative. true = magnetic + declination.
function applyDeclination(magneticHeading, declination) {
  return normalize360(magneticHeading + declination);
}

// The raw sensor heading jitters by several degrees every reading. A plain
// running average breaks at the 360->0 seam (averaging 359 and 1 should give 0,
// not 180). So we average the heading as a 2D unit vector (cos, sin) instead,
// which has no seam, then turn it back into an angle.
//
// makeSmoother(alpha) returns a function you feed raw headings to; it returns
// the smoothed heading. alpha is 0..1 — higher = snappier but jumpier,
// lower = steadier but laggier. 0.2 is a good glasses default.
function makeSmoother(alpha) {
  let x = null; // smoothed cosine
  let y = null; // smoothed sine
  return function push(headingDeg) {
    const r = (headingDeg * Math.PI) / 180;
    const cx = Math.cos(r);
    const sy = Math.sin(r);
    if (x === null) {
      x = cx;
      y = sy;
    } else {
      x = x + alpha * (cx - x);
      y = y + alpha * (sy - y);
    }
    return normalize360((Math.atan2(y, x) * 180) / Math.PI);
  };
}

// Export for node tests. In the browser there is no `module`, so we guard it.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalize360,
    angularDifference,
    cardinal,
    applyDeclination,
    makeSmoother,
  };
}
