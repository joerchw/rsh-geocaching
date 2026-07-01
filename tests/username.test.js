import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadUsername, saveUsername, hasUsername } from '../js/username.js';

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

test('loadUsername: liefert "" wenn kein Eintrag im localStorage', () => {
  global.localStorage.clear();
  assert.equal(loadUsername(), '');
});

test('hasUsername: false wenn kein Name gesetzt', () => {
  global.localStorage.clear();
  assert.equal(hasUsername(), false);
});

test('saveUsername + loadUsername: round-trip', () => {
  global.localStorage.clear();
  saveUsername('Mira');
  assert.equal(loadUsername(), 'Mira');
  assert.equal(hasUsername(), true);
});

test('saveUsername: trimmt Leerzeichen', () => {
  global.localStorage.clear();
  saveUsername('  Mira  ');
  assert.equal(loadUsername(), 'Mira');
});

test('saveUsername: nur Leerzeichen → hasUsername bleibt false', () => {
  global.localStorage.clear();
  saveUsername('   ');
  assert.equal(hasUsername(), false);
});
