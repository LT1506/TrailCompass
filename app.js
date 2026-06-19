// app.js
// The GLUE. This is the only file that touches both the sensor and the screen.
// It wires:  sensor -> compass math -> DOM,  and  GPS -> declination.
// Keep logic thin here; anything mathy belongs in compass.js.

var BUILD = 'v1.2.0'; // bump on every deploy so the glasses confirm fresh code

(function () {
  // --- grab elements once ---
  var startScreen = document.getElementById('start-screen');
  var compassScreen = document.getElementById('compass-screen');
  var startBtn = document.getElementById('start-btn');
  var headingNum = document.getElementById('heading-num');
  var headingCard = document.getElementById('heading-card');
  var rose = document.getElementById('rose');
  var refFlag = document.getElementById('ref-flag');
  var gpsFlag = document.getElementById('gps-flag');
  var decFlag = document.getElementById('dec-flag');
  var accFlag = document.getElementById('acc-flag');
  var buildFlag = document.getElementById('build-flag');
  var message = document.getElementById('message');
  var debugEl = document.getElementById('debug');
  var markBtn = document.getElementById('mark-btn');
  var backtrackEl = document.getElementById('backtrack');
  var homeRotor = document.getElementById('home-rotor');

  buildFlag.textContent = BUILD;

  // Debug mode: add ?debug=1 to the URL (easy to type on the glasses).
  var DEBUG = location.search.indexOf('debug') >= 0 || location.hash.indexOf('debug') >= 0;
  if (DEBUG) debugEl.classList.remove('hidden');

  // Render the raw sensor values + both candidate headings so we can compare
  // them against a known-good phone and find the right conversion.
  function showDebug(raw) {
    function n(v) { return v === null || v === undefined ? '--' : v.toFixed(1); }
    var naive = raw.alpha === null || raw.alpha === undefined
      ? '--'
      : Math.round(naiveHeadingFromAlpha(raw.alpha, raw.screenAngle));
    var tilt = raw.alpha === null || raw.alpha === undefined
      ? '--'
      : Math.round(tiltCompensatedHeading(raw.alpha, raw.beta, raw.gamma));
    debugEl.innerHTML =
      'event   ' + raw.event + '  abs=' + raw.absolute + '\n' +
      'alpha   ' + n(raw.alpha) + '\n' +
      'beta    ' + n(raw.beta) + '\n' +
      'gamma   ' + n(raw.gamma) + '\n' +
      'wkComp  ' + n(raw.webkitCompassHeading) + '\n' +
      'screen  ' + raw.screenAngle + '\n' +
      '------\n' +
      'A naive ' + naive + '\n' +
      'B tilt  ' + tilt;
  }

  // --- state ---
  var settings = loadSettings();
  var declination = settings.manualDeclination; // null until GPS/cache fills it
  var usingTrue = typeof declination === 'number';
  var smooth = makeSmoother(0.2); // circular low-pass; see compass.js

  // --- back-track state ---
  var currentPos = null;       // latest GPS fix {lat,lon,...}
  var waypoint = loadWaypoint(); // dropped start point {lat,lon,ts} or null
  var backBearing = null;      // computed direction (deg) to the start point
  var backDistText = '';       // formatted distance to the start point
  var gpsStale = false;        // true once GPS drops after we had a fix
  var declResolved = false;    // have we looked up declination yet?
  var lastShown = 0;           // most recent displayed heading (for live re-render)

  function setMessage(text) {
    message.textContent = text || '';
  }

  // Called many times per second with a fresh MAGNETIC heading.
  function onHeading(magneticDeg, accuracyDeg) {
    var steady = smooth(magneticDeg);
    var shown = usingTrue ? applyDeclination(steady, declination) : steady;

    headingNum.textContent = String(Math.round(shown)).padStart(3, '0');
    headingCard.textContent = cardinal(shown);

    // Rotate the rose so its "N" points to real north: turn it opposite the
    // heading. The fixed top arrow then sits at the direction you're facing.
    rose.style.transform = 'rotate(' + (-shown) + 'deg)';

    refFlag.textContent = usingTrue ? 'TRUE' : 'MAG';
    refFlag.classList.toggle('is-true', usingTrue);

    if (accuracyDeg === null) {
      accFlag.textContent = 'ACC --';
    } else {
      accFlag.textContent = 'ACC ±' + Math.round(accuracyDeg) + '°';
      if (accuracyDeg > 25) setMessage('Low accuracy — wave the glasses in a figure-8');
      else setMessage('');
    }

    // Back-track marker + turn cue update with the heading (fast), so the home
    // arrow and "turn left/right" stay live even between GPS fixes.
    lastShown = shown;
    if (waypoint) renderBacktrack(shown);
  }

  // Draw the home marker on the rose and the BACK line. `shown` is the current
  // true heading. backBearing/backDistText come from the latest GPS fix.
  function renderBacktrack(shown) {
    if (!waypoint || backBearing === null) {
      homeRotor.classList.add('hidden');
      return;
    }
    homeRotor.classList.remove('hidden');
    // Place the marker at the start's direction relative to where you face.
    homeRotor.style.transform = 'rotate(' + (backBearing - shown) + 'deg)';

    var turn = angularDifference(shown, backBearing);
    var cue;
    if (Math.abs(turn) <= 8) cue = '• straight ahead';
    else if (turn > 0) cue = '→ right ' + Math.round(turn) + '°';
    else cue = '← left ' + Math.round(-turn) + '°';

    backtrackEl.innerHTML =
      'BACK ' + Math.round(backBearing) + '° · ' + backDistText +
      ' · <span class="turn">' + cue + '</span>';
    backtrackEl.classList.toggle('stale', gpsStale);
    backtrackEl.classList.remove('hidden');
  }

  function onStatus(state) {
    if (state === 'listening') setMessage('');
    else if (state === 'denied') setMessage('Compass permission denied. Reload and allow motion access.');
    else if (state === 'unsupported') setMessage('This device has no orientation sensor.');
    else if (state === 'no-absolute') setMessage('No compass reading here (a laptop has no magnetometer). Try on the glasses or a phone.');
  }

  // Look up declination from a GPS fix (once). Honors a manual override.
  function resolveDeclinationFrom(fix) {
    declResolved = true;
    if (typeof settings.manualDeclination === 'number') {
      declination = settings.manualDeclination;
      usingTrue = true;
      decFlag.textContent = 'DEC ' + declination.toFixed(1) + '° (man)';
      return;
    }
    getDeclination(fix.lat, fix.lon).then(function (result) {
      if (result && typeof result.value === 'number') {
        declination = result.value;
        usingTrue = true;
        decFlag.textContent =
          'DEC ' + declination.toFixed(1) + '° (' + result.source + ')';
      } else {
        decFlag.textContent = 'DEC n/a';
      }
    });
  }

  // Recompute bearing + distance from the current position to the start point.
  function computeBacktrack() {
    if (!waypoint || !currentPos) return;
    backBearing = bearingTo(currentPos.lat, currentPos.lon, waypoint.lat, waypoint.lon);
    backDistText = formatDistanceUS(
      distanceMeters(currentPos.lat, currentPos.lon, waypoint.lat, waypoint.lon)
    );
    renderBacktrack(lastShown);
  }

  // Every GPS reading.
  function onFix(fix) {
    currentPos = fix;
    gpsStale = false;
    gpsFlag.textContent = 'GPS ok';
    if (!declResolved) resolveDeclinationFrom(fix);
    if (waypoint) computeBacktrack();
  }

  function onGpsError() {
    gpsFlag.textContent = 'GPS no';
    if (!declResolved) decFlag.textContent = 'DEC n/a';
    if (waypoint && backBearing !== null) {
      gpsStale = true; // keep last bearing/distance, but flag it as old
      renderBacktrack(lastShown);
    }
  }

  // Reflect the waypoint state in the button label + what's visible.
  function updateMarkUI() {
    if (waypoint) {
      markBtn.textContent = 'Clear start point';
      computeBacktrack();
    } else {
      markBtn.textContent = 'Drop start point';
      backBearing = null;
      backDistText = '';
      backtrackEl.classList.add('hidden');
      homeRotor.classList.add('hidden');
    }
  }

  // Single button that drops the start point, then clears it.
  function onMark() {
    if (waypoint) {
      waypoint = null;
      clearWaypoint();
      gpsStale = false;
      updateMarkUI();
      setMessage('Start point cleared');
    } else if (!currentPos) {
      setMessage('Waiting for GPS — try again in a moment');
    } else {
      waypoint = { lat: currentPos.lat, lon: currentPos.lon, ts: Date.now() };
      saveWaypoint(waypoint);
      updateMarkUI();
      setMessage('Start point dropped');
    }
  }

  function startApp() {
    startScreen.classList.add('hidden');
    compassScreen.classList.remove('hidden');
    markBtn.focus(); // so a single pinch (= Enter) fires Drop/Clear
    start({
      onHeading: onHeading,
      onStatus: onStatus,
      onRaw: DEBUG ? showDebug : null,
    }); // sensor.js
    watch(onFix, onGpsError); // location.js — continuous GPS for back-track
    updateMarkUI(); // auto-restore a saved start point if one exists
  }

  startBtn.addEventListener('click', startApp);
  markBtn.addEventListener('click', onMark);
  bindKeys({ select: function () {} });

  // Register the network-first service worker (offline support on the trail).
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
