import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceMeters, bearingDegrees, formatDistance } from '../js/geo.js';

test('distance is zero for identical points', () => {
  assert.equal(distanceMeters(51, 7, 51, 7), 0);
});

test('0.01 degree latitude is about 1112 m', () => {
  const d = distanceMeters(51.0, 7.0, 51.01, 7.0);
  assert.ok(Math.abs(d - 1112) < 5, `expected ~1112, got ${d}`);
});

test('bearing due north is ~0 and due east is ~90', () => {
  assert.ok(Math.abs(bearingDegrees(0, 0, 1, 0) - 0) < 0.5);
  assert.ok(Math.abs(bearingDegrees(0, 0, 0, 1) - 90) < 0.5);
});

test('formatDistance shows meters under 1 km and km above', () => {
  assert.equal(formatDistance(500), '500 m');
  assert.equal(formatDistance(1500), '1,50 km');
  assert.equal(formatDistance(NaN), '–');
});
