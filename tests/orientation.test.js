import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angleDelta } from '../js/geo.js';

test('angleDelta takes the short way forward across 0', () => {
  // from 358° toward 2° must be +4°, NOT -356°
  assert.equal(angleDelta(2, 358), 4);
});

test('angleDelta takes the short way backward across 0', () => {
  assert.equal(angleDelta(358, 2), -4);
});

test('angleDelta is 0 for equal angles', () => {
  assert.equal(angleDelta(90, 90), 0);
});

test('angleDelta works with an unwrapped (large) current angle', () => {
  // current may have accumulated past 360 in the UI
  assert.equal(angleDelta(10, 730), 0); // 730 ≡ 10 (mod 360)
});

test('angleDelta result is always within -180..180', () => {
  for (let t = 0; t < 360; t += 17) {
    for (let c = 0; c < 360; c += 23) {
      const d = angleDelta(t, c);
      assert.ok(d > -180.0001 && d <= 180.0001, `delta ${d} out of range for ${t},${c}`);
    }
  }
});
