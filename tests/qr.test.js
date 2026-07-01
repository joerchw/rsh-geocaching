import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_BESCHREIBUNG_BYTES,
  truncateDescriptionForQr,
  encodeCacheQrPayload,
  decodeCacheQrPayload,
} from '../js/qr.js';

const cache = {
  id: 'student-mira-a8f3',
  name: 'Am Baum',
  beschreibung: 'Hinter der Bank am großen Baum.',
  codewort: 'Eiche',
  latitude: 51.389567,
  longitude: 7.702367,
  ersteller: 'Mira',
};

test('truncateDescriptionForQr: kurzer Text bleibt unverändert', () => {
  const result = truncateDescriptionForQr('Kurzer Text');
  assert.equal(result.text, 'Kurzer Text');
  assert.equal(result.truncated, false);
});

test('truncateDescriptionForQr: langer Text wird gekürzt und mit … versehen', () => {
  const long = 'A'.repeat(1000);
  const result = truncateDescriptionForQr(long);
  assert.equal(result.truncated, true);
  assert.ok(result.text.endsWith('…'));
  const enc = new TextEncoder();
  assert.ok(enc.encode(JSON.stringify(result.text)).length <= MAX_BESCHREIBUNG_BYTES);
});

test('truncateDescriptionForQr: respektiert ein eigenes Byte-Budget', () => {
  const result = truncateDescriptionForQr('A'.repeat(100), 20);
  assert.equal(result.truncated, true);
  const enc = new TextEncoder();
  assert.ok(enc.encode(JSON.stringify(result.text)).length <= 20);
});

test('encodeCacheQrPayload/decodeCacheQrPayload: Roundtrip erhält alle Felder', () => {
  const { text, truncated } = encodeCacheQrPayload(cache);
  assert.equal(truncated, false);
  const decoded = decodeCacheQrPayload(text);
  assert.deepEqual(decoded, cache);
});

test('encodeCacheQrPayload: ersteller wird null wenn nicht gesetzt', () => {
  const { text } = encodeCacheQrPayload({ ...cache, ersteller: undefined });
  const decoded = decodeCacheQrPayload(text);
  assert.equal(decoded.ersteller, null);
});

test('encodeCacheQrPayload: lange Beschreibung wird gekürzt, andere Felder bleiben vollständig', () => {
  const longCache = { ...cache, beschreibung: 'B'.repeat(1000) };
  const { text, truncated } = encodeCacheQrPayload(longCache);
  assert.equal(truncated, true);
  const decoded = decodeCacheQrPayload(text);
  assert.equal(decoded.id, longCache.id);
  assert.equal(decoded.latitude, longCache.latitude);
  assert.equal(decoded.longitude, longCache.longitude);
  assert.equal(decoded.codewort, longCache.codewort);
  assert.ok(decoded.beschreibung.length < longCache.beschreibung.length);
});

test('decodeCacheQrPayload: lehnt kaputtes JSON ab', () => {
  assert.throws(() => decodeCacheQrPayload('KAPUTT'), /Kein gültiger Cache-Code/);
});

test('decodeCacheQrPayload: lehnt JSON ohne rshCache-Marker ab', () => {
  assert.throws(() => decodeCacheQrPayload(JSON.stringify({ foo: 'bar' })), /Kein gültiger Cache-Code/);
});

test('decodeCacheQrPayload: lehnt Payload mit fehlendem Pflichtfeld ab', () => {
  const bad = { rshCache: 1, id: 'x', name: 'x', beschreibung: 'x', latitude: 1, longitude: 1 }; // kein codewort
  assert.throws(() => decodeCacheQrPayload(JSON.stringify(bad)), /Kein gültiger Cache-Code/);
});

test('decodeCacheQrPayload: lehnt fremden QR-Inhalt (z. B. eine URL) ab', () => {
  assert.throws(() => decodeCacheQrPayload('https://example.com'), /Kein gültiger Cache-Code/);
});
