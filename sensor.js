// sensor.js
// The trickiest file. It hides every browser/OS difference and hands the rest
// of the app ONE clean thing: a magnetic heading from 0..360 where 0 = north,
// counting clockwise (so 90 = east). All the messy cases live here.
//
// Two worlds:
//  - iOS / Safari: the orientation event carries `webkitCompassHeading`, which
//    is already a true compass heading (magnetic), clockwise from north. Easy.
//  - Android / Chrome: no webkitCompassHeading. We use the "absolute"
//    orientation event's `alpha` and convert it, and we also correct for how
//    the screen itself is rotated.
//
// iOS 13+ also requires us to ASK PERMISSION, and that request must happen
// inside a user tap — which is why the UI has a "Start" button.

function screenAngle() {
  // How far the screen is rotated from its natural orientation, in degrees.
  if (screen.orientation && typeof screen.orientation.angle === 'number') {
    return screen.orientation.angle;
  }
  if (typeof window.orientation === 'number') {
    return window.orientation;
  }
  return 0;
}

// Convert one raw orientation event into a magnetic compass heading, or null
// if this event doesn't carry usable absolute heading data.
function headingFromEvent(e) {
  // iOS path: already a compass heading, clockwise from north. Done.
  if (typeof e.webkitCompassHeading === 'number') {
    return e.webkitCompassHeading;
  }
  // Android/standards path: needs absolute data and an alpha value.
  if (e.absolute === true && typeof e.alpha === 'number') {
    // alpha increases counter-clockwise, so compass heading = 360 - alpha,
    // then add the screen rotation so it stays correct if the display is turned.
    return (((360 - e.alpha) + screenAngle()) % 360 + 360) % 360;
  }
  return null;
}

// start(callbacks) begins listening. callbacks:
//   onHeading(magneticDeg, accuracyDeg|null)
//   onStatus(stateString)   e.g. 'listening', 'denied', 'unsupported', 'no-absolute'
//   onRaw(rawObj)           OPTIONAL — fired every event with the unprocessed
//                           sensor fields, for the debug overlay only.
// Returns a stop() function.
function start({ onHeading, onStatus, onRaw }) {
  if (typeof DeviceOrientationEvent === 'undefined') {
    onStatus('unsupported');
    return function stop() {};
  }

  let sawAbsolute = false;
  const eventName =
    'ondeviceorientationabsolute' in window
      ? 'deviceorientationabsolute' // Chrome/Android: true north reference
      : 'deviceorientation'; // iOS provides webkitCompassHeading here

  function handler(e) {
    // Hand the debug overlay the raw fields BEFORE any of our processing, so we
    // can see exactly what the device reported even if our math returns null.
    if (onRaw) {
      onRaw({
        event: eventName,
        absolute: e.absolute === true,
        alpha: e.alpha,
        beta: e.beta,
        gamma: e.gamma,
        webkitCompassHeading:
          typeof e.webkitCompassHeading === 'number' ? e.webkitCompassHeading : null,
        webkitCompassAccuracy:
          typeof e.webkitCompassAccuracy === 'number' ? e.webkitCompassAccuracy : null,
        screenAngle: screenAngle(),
      });
    }
    const heading = headingFromEvent(e);
    if (heading === null) {
      // Got events but no absolute reference — common on desktops/laptops.
      if (!sawAbsolute) onStatus('no-absolute');
      return;
    }
    sawAbsolute = true;
    const accuracy =
      typeof e.webkitCompassAccuracy === 'number' && e.webkitCompassAccuracy >= 0
        ? e.webkitCompassAccuracy
        : null;
    onHeading(heading, accuracy);
  }

  function begin() {
    window.addEventListener(eventName, handler, true);
    onStatus('listening');
  }

  // iOS 13+ permission gate. requestPermission() must be called from a user tap.
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then(function (state) {
        if (state === 'granted') begin();
        else onStatus('denied');
      })
      .catch(function () {
        onStatus('denied');
      });
  } else {
    begin();
  }

  return function stop() {
    window.removeEventListener(eventName, handler, true);
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { headingFromEvent, start };
}
