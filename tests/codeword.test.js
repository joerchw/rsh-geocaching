import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCodeword, checkCodeword } from '../js/codeword.js';

test('normalize trims and lowercases', () => {
  assert.equal(normalizeCodeword('  Eichhörnchen  '), 'eichhörnchen');
  assert.equal(normalizeCodeword(null), '');
});

test('correct codeword matches regardless of case and spaces', () => {
  assert.equal(checkCodeword('  EICHHÖRNCHEN ', 'Eichhörnchen'), true);
});

test('wrong codeword does not match', () => {
  assert.equal(checkCodeword('Fuchs', 'Eichhörnchen'), false);
});

test('empty expected never matches', () => {
  assert.equal(checkCodeword('', ''), false);
  assert.equal(checkCodeword('   ', '   '), false);
});
