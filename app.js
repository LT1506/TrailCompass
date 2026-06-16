// app.js
// The GLUE. This is the only file that touches both the sensor and the screen.
// It wires:  sensor -> compass math -> DOM,  and  GPS -> declination.
// Keep logic thin here; anything mathy belongs in compass.js.

var BUILD = 'v1.1.0-dbg'; // bump on every deploy so the glasses confirm fresh code

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
  }

  function onStatus(state) {
    if (state === 'listening') setMessage('');
    else if (state === 'denied') setMessage('Compass permission denied. Reload and allow motion access.');
    else if (state === 'unsupported') setMessage('This device has no orientation sensor.');
    else if (state === 'no-absolute') setMessage('No compass reading here (a laptop has no magnetometer). Try on the glasses or a phone.');
  }

  // Get a GPS fix, then look up declination and switch to TRUE north.
  function resolveDeclination() {
    // Honor a manual override if the user set one.
    if (typeof settings.manualDeclination === 'number') {
      declination = settings.manualDeclination;
      usingTrue = true;
      decFlag.textContent = 'DEC ' + declination.toFixed(1) + '° (man)';
      return;
    }
    gpsFlag.textContent = 'GPS...';
    getFix()
      .then(function (fix) {
        gpsFlag.textContent = 'GPS ok';
        return getDeclination(fix.lat, fix.lon);
      })
      .then(function (result) {
        if (result && typeof result.value === 'number') {
          declination = result.value;
          usingTrue = true;
          decFlag.textContent =
            'DEC ' + declination.toFixed(1) + '° (' + result.source + ')';
        } else {
          decFlag.textContent = 'DEC n/a';
        }
      })
      .catch(function () {
        gpsFlag.textContent = 'GPS no';
        decFlag.textContent = 'DEC n/a';
        // Stay in MAG mode — still a usable compass, just not map-true.
      });
  }

  function startApp() {
    startScreen.classList.add('hidden');
    compassScreen.classList.remove('hidden');
    start({
      onHeading: onHeading,
      onStatus: onStatus,
      onRaw: DEBUG ? showDebug : null,
    }); // sensor.js
    resolveDeclination();
  }

  startBtn.addEventListener('click', startApp);
  // Pinch/Enter on the focused Start button also triggers it (button default),
  // but wire arrow/enter shortcuts for future screens.
  bindKeys({ select: function () {} });

  // Register the network-first service worker (offline support on the trail).
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
