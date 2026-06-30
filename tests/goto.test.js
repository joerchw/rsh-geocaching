import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGotoTarget, saveGotoTarget } from '../js/goto.js';

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

test('loadGotoTarget: liefert null, wenn kein Eintrag im localStorage', () => {
  global.localStorage.clear();
  assert.equal(loadGotoTarget(), null);
});

test('loadGotoTarget: liefert null bei ungültigem JSON', () => {
  global.localStorage.clear();
  global.localStorage.setItem('rsh_goto_target', 'KAPUTT');
  assert.equal(loadGotoTarget(), null);
});

test('loadGotoTarget: liefert null, wenn latRaw/lonRaw fehlen', () => {
  global.localStorage.clear();
  global.localStorage.setItem('rsh_goto_target', JSON.stringify({ foo: 'bar' }));
  assert.equal(loadGotoTarget(), null);
});

test('saveGotoTarget + loadGotoTarget: round-trip', () => {
  global.localStorage.clear();
  saveGotoTarget('51.389567', '7.702367');
  const loaded = loadGotoTarget();
  assert.deepEqual(loaded, { latRaw: '51.389567', lonRaw: '7.702367' });
});

test('saveGotoTarget: überschreibt vorheriges Ziel', () => {
  global.localStorage.clear();
  saveGotoTarget('1', '2');
  saveGotoTarget('51.389567', 'N 7° 42.142′');
  const loaded = loadGotoTarget();
  assert.deepEqual(loaded, { latRaw: '51.389567', lonRaw: 'N 7° 42.142′' });
});
