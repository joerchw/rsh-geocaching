import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCaches } from '../js/caches.js';

// Mock localStorage for Node.js (functions reference it lazily at call time, not import time)
global.localStorage = (() => {
  let store = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

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

import {
  loadStudentCaches,
  saveStudentCaches,
  generateStudentId,
} from '../js/caches.js';

test('loadStudentCaches: liefert [] wenn kein Eintrag im localStorage', () => {
  global.localStorage.clear();
  assert.deepEqual(loadStudentCaches(), []);
});

test('loadStudentCaches: liefert [] bei ungültigem JSON', () => {
  global.localStorage.clear();
  global.localStorage.setItem('rsh_student_caches', 'KAPUTT');
  assert.deepEqual(loadStudentCaches(), []);
});

test('saveStudentCaches + loadStudentCaches: round-trip', () => {
  global.localStorage.clear();
  const caches = [
    { id: 'student-01', name: 'Test', beschreibung: 'Desc', codewort: 'XY',
      latitude: 51.0, longitude: 7.0 }
  ];
  saveStudentCaches(caches);
  const loaded = loadStudentCaches();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, 'student-01');
  assert.equal(loaded[0].name, 'Test');
});

test('generateStudentId: erste ID ist student-01 für leeres Array', () => {
  assert.equal(generateStudentId([]), 'student-01');
});

test('generateStudentId: nächste ID nach student-01 ist student-02', () => {
  assert.equal(generateStudentId([{ id: 'student-01' }]), 'student-02');
});

test('generateStudentId: ignoriert Einträge mit fremdem ID-Präfix', () => {
  assert.equal(generateStudentId([{ id: 'cache-01' }, { id: 'cache-02' }]), 'student-01');
});

test('generateStudentId: wählt max+1 auch bei Lücken', () => {
  assert.equal(generateStudentId([{ id: 'student-03' }]), 'student-04');
});
