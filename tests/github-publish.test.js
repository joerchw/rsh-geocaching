import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGithubToken, saveGithubToken, clearGithubToken, utf8ToBase64 } from '../js/github-publish.js';

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

test('loadGithubToken: liefert null wenn kein Token gespeichert ist', () => {
  global.localStorage.clear();
  assert.equal(loadGithubToken(), null);
});

test('saveGithubToken + loadGithubToken: round-trip', () => {
  global.localStorage.clear();
  saveGithubToken('github_pat_abc123');
  assert.equal(loadGithubToken(), 'github_pat_abc123');
});

test('saveGithubToken: trimmt Leerzeichen', () => {
  global.localStorage.clear();
  saveGithubToken('  github_pat_abc123  ');
  assert.equal(loadGithubToken(), 'github_pat_abc123');
});

test('clearGithubToken: entfernt gespeicherten Token', () => {
  global.localStorage.clear();
  saveGithubToken('github_pat_abc123');
  clearGithubToken();
  assert.equal(loadGithubToken(), null);
});

test('utf8ToBase64: roundtrip mit ASCII', () => {
  const encoded = utf8ToBase64('hello world');
  const decoded = new TextDecoder().decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)));
  assert.equal(decoded, 'hello world');
});

test('utf8ToBase64: roundtrip mit deutschen Umlauten', () => {
  const original = 'Bäckerei an der Grünstraße, Brötchen ß ü ö ä';
  const encoded = utf8ToBase64(original);
  const decoded = new TextDecoder().decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)));
  assert.equal(decoded, original);
});

test('utf8ToBase64: leerer String', () => {
  assert.equal(utf8ToBase64(''), '');
});
