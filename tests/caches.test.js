import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCaches } from '../js/caches.js';

const valid = [
  {
    id: 'cache-01',
    name: 'Der alte Baum',
    beschreibung: 'Suche bei der großen Eiche.',
    latitude: 51.1234,
    longitude: 7.5678,
    codewort: 'Eichhörnchen'
  }
];

test('parses a valid cache array', () => {
  const result = parseCaches(valid);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'cache-01');
  assert.equal(typeof result[0].latitude, 'number');
});

test('parses from a JSON string', () => {
  const result = parseCaches(JSON.stringify(valid));
  assert.equal(result[0].name, 'Der alte Baum');
});

test('rejects non-array input', () => {
  assert.throws(() => parseCaches({ id: 'x' }), /Liste/);
});

test('rejects a missing required field', () => {
  const bad = [{ id: 'c', name: '', beschreibung: 'b', latitude: 51, longitude: 7, codewort: 'k' }];
  assert.throws(() => parseCaches(bad), /name/);
});

test('rejects an out-of-range latitude', () => {
  const bad = [{ id: 'c', name: 'n', beschreibung: 'b', latitude: 999, longitude: 7, codewort: 'k' }];
  assert.throws(() => parseCaches(bad), /latitude/);
});

test('rejects duplicate ids', () => {
  const dup = [valid[0], valid[0]];
  assert.throws(() => parseCaches(dup), /doppelt|mehrfach|id/i);
});
