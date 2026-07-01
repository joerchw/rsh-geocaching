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

test('generateStudentId: Format ist student-<slug>-<4-hex>', () => {
  const id = generateStudentId('Mira');
  assert.match(id, /^student-mira-[0-9a-f]{4}$/);
});

test('generateStudentId: Username wird lowercased und Sonderzeichen entfernt', () => {
  const id = generateStudentId('Émile-Jöhn 2!');
  assert.match(id, /^student-[a-z0-9]{1,12}-[0-9a-f]{4}$/);
});

test('generateStudentId: Slug wird auf 12 Zeichen gekürzt', () => {
  const id = generateStudentId('einextremlangername');
  const slug = id.split('-')[1];
  assert.ok(slug.length <= 12, `slug "${slug}" sollte <= 12 Zeichen sein`);
});

test('generateStudentId: leerer/nur-Sonderzeichen-Username → Fallback "schueler"', () => {
  assert.match(generateStudentId('!!!'), /^student-schueler-[0-9a-f]{4}$/);
  assert.match(generateStudentId(''), /^student-schueler-[0-9a-f]{4}$/);
});

import { isKnownCacheId } from '../js/caches.js';

test('isKnownCacheId: true wenn die ID bereits vorhanden ist', () => {
  const existing = [{ id: 'student-mira-a8f3', name: 'Am Baum' }];
  assert.equal(isKnownCacheId(existing, 'student-mira-a8f3'), true);
});

test('isKnownCacheId: false wenn die ID noch nicht vorhanden ist', () => {
  const existing = [{ id: 'student-mira-a8f3', name: 'Am Baum' }];
  assert.equal(isKnownCacheId(existing, 'student-tom-1234'), false);
});

test('isKnownCacheId: false bei leerem Array', () => {
  assert.equal(isKnownCacheId([], 'student-mira-a8f3'), false);
});
