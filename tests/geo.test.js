import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceMeters, bearingDegrees, formatDistance } from '../js/geo.js';
import { parseCoordinate } from '../js/geo.js';

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

// parseCoordinate tests

// Dezimalgrad
test('parseCoordinate: Dezimalgrad mit Punkt', () => {
  assert.equal(parseCoordinate('51.389567'), 51.389567);
});

test('parseCoordinate: Dezimalgrad mit Komma (deutsche Tastatur)', () => {
  assert.equal(parseCoordinate('51,389567'), 51.389567);
});

test('parseCoordinate: negativer Dezimalgrad', () => {
  assert.equal(parseCoordinate('-7.702367'), -7.702367);
});

test('parseCoordinate: Dezimalgrad mit N-Präfix', () => {
  assert.equal(parseCoordinate('N 51.389567'), 51.389567);
});

test('parseCoordinate: Dezimalgrad mit S-Präfix → negativ', () => {
  assert.equal(parseCoordinate('S 51.389567'), -51.389567);
});

// Grad Dezimalminuten
test('parseCoordinate: GDM N-Präfix mit Grad-Symbol und Minute', () => {
  const expected = 51 + 23.374 / 60;
  const result = parseCoordinate("N 51° 23.374'");
  assert.ok(result !== null, 'result should not be null');
  assert.ok(Math.abs(result - expected) < 1e-9, `expected ${expected}, got ${result}`);
});

test('parseCoordinate: GDM N-Suffix', () => {
  const expected = 51 + 23.374 / 60;
  const result = parseCoordinate("51° 23.374' N");
  assert.ok(Math.abs(result - expected) < 1e-9);
});

test('parseCoordinate: GDM ohne Sonderzeichen (N-Präfix, Leerzeichen)', () => {
  const expected = 51 + 23.374 / 60;
  const result = parseCoordinate('N51 23.374');
  assert.ok(Math.abs(result - expected) < 1e-9);
});

test('parseCoordinate: GDM kompakt ohne Himmelsrichtung', () => {
  const expected = 51 + 23.374 / 60;
  const result = parseCoordinate('51°23.374');
  assert.ok(Math.abs(result - expected) < 1e-9);
});

test('parseCoordinate: GDM mit Komma als Dezimaltrennzeichen', () => {
  const expected = 51 + 23.374 / 60;
  const result = parseCoordinate("N 51° 23,374'");
  assert.ok(Math.abs(result - expected) < 1e-9);
});

// Ungültig
test('parseCoordinate: Buchstaben → null', () => {
  assert.equal(parseCoordinate('abc'), null);
});

test('parseCoordinate: leerer String → null', () => {
  assert.equal(parseCoordinate(''), null);
});

test('parseCoordinate: GDM mit Minuten >= 60 → null', () => {
  assert.equal(parseCoordinate("51° 60.000'"), null);
});

test('parseCoordinate: nicht-String → null', () => {
  assert.equal(parseCoordinate(null), null);
  assert.equal(parseCoordinate(51.5), null);
});
