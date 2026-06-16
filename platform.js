// platform.js
// Input adapter for the glasses. The Neural Band sends swipes as ARROW KEYS and
// a single pinch as ENTER (see RangeHUD notes). v1 has almost no navigation, but
// we keep the seam here so phase C can add screens without rewiring input.
//
// bindKeys(map) calls map.select / map.back / map.next / map.prev on the right
// key. Buttons still work with a normal pinch (Enter activates a focused button)
// without any help, so this is just for app-level shortcuts.
function bindKeys(map) {
  window.addEventListener('keydown', function (e) {
    switch (e.key) {
      case 'Enter':
        if (map.select) map.select();
        break;
      case 'Escape':
      case 'ArrowLeft':
        if (map.back) map.back();
        break;
      case 'ArrowRight':
        if (map.next) map.next();
        break;
      case 'ArrowUp':
        if (map.prev) map.prev();
        break;
      case 'ArrowDown':
        if (map.next) map.next();
        break;
      default:
        break;
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { bindKeys };
}
