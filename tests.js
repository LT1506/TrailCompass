// tests.js — pure-function checks. Run with:  node tests.js
// No browser needed: only the math files (compass.js) export to node.

var c = require('./compass.js');

var passed = 0;
var failed = 0;

function eq(name, got, want) {
  if (got === want) {
    passed++;
  } else {
    failed++;
    console.log('FAIL ' + name + ': got ' + got + ', want ' + want);
  }
}

function near(name, got, want, tol) {
  if (Math.abs(got - want) <= tol) {
    passed++;
  } else {
    failed++;
    console.log('FAIL ' + name + ': got ' + got + ', want ~' + want);
  }
}

// normalize360
eq('normalize -10', c.normalize360(-10), 350);
eq('normalize 370', c.normalize360(370), 10);
eq('normalize 0', c.normalize360(0), 0);
eq('normalize 720', c.normalize360(720), 0);

// cardinal names + boundaries
eq('cardinal 0', c.cardinal(0), 'N');
eq('cardinal 90', c.cardinal(90), 'E');
eq('cardinal 180', c.cardinal(180), 'S');
eq('cardinal 270', c.cardinal(270), 'W');
eq('cardinal 315', c.cardinal(315), 'NW');
eq('cardinal 359', c.cardinal(359), 'N');     // wraps back to N
eq('cardinal 11', c.cardinal(11), 'N');       // just under the 11.25 N/NNE line
eq('cardinal 24', c.cardinal(24), 'NNE');

// applyDeclination (true = magnetic + declination, with wrap)
eq('dec +10 of 350', c.applyDeclination(350, 10), 0);
eq('dec -15 of 5', c.applyDeclination(5, -15), 350);
eq('dec 0', c.applyDeclination(123, 0), 123);

// angularDifference: sign = which way to turn
eq('diff N->E', c.angularDifference(0, 90), 90);     // turn right
eq('diff N->W', c.angularDifference(0, 270), -90);   // turn left
eq('diff seam', c.angularDifference(350, 10), 20);   // across 360, turn right
eq('diff same', c.angularDifference(45, 45), 0);

// smoother: averages across the 360->0 seam without jumping to 180
var s = c.makeSmoother(0.5);
s(359);
var out = s(1); // should head toward 0, not toward 180
if (out > 180) out = out - 360; // express near-0 as small signed value
near('smoother seam', out, 0, 5);

// smoother converges to a steady input
var s2 = c.makeSmoother(0.3);
var v;
for (var i = 0; i < 50; i++) v = s2(120);
near('smoother converge', v, 120, 0.5);

console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
