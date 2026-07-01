# QR-Cache-Sharing (Schüler ↔ Schüler, Schüler → Lehrer) — Design Spec

## Ziel

Eigene Caches (siehe [`2026-06-30-lokale-cache-eingabe-design.md`](2026-06-30-lokale-cache-eingabe-design.md))
lassen sich per QR-Code zwischen Geräten weitergeben, ohne Netzwerk oder Server:

- **Schüler ↔ Schüler:** Ein Schüler zeigt seinen eigenen Cache als QR-Code, ein anderer
  Schüler scannt ihn und übernimmt ihn lokal in seine eigene Cache-Liste.
- **Schüler → Lehrer:** Der Lehrer kann im Adminbereich einen Schüler-QR-Code scannen, um ihn
  als Vorlage für einen offiziellen Cache zu übernehmen (nach Prüfung/Anpassung).

Kein automatischer GitHub-Sync ist Teil dieses Designs — der bestehende manuelle
„JSON exportieren"-Schritt in `lehrer.html` bleibt unverändert.

---

## Bibliotheken

Zwei zusätzliche vendorte Libraries nach dem Leaflet-Muster (`vendor/<lib>/`, als globales
`<script>`-Tag eingebunden, kein Build-Schritt, keine npm-Abhängigkeit):

| Library | Zweck | Größe | Einbindung |
|---------|-------|-------|------------|
| `qrcode-generator` (kazuhikoarase) | QR-Code erzeugen | ~30 KB | `vendor/qrcode/qrcode.js`, globale Funktion `qrcode(...)` |
| `jsQR` | QR-Code aus Kamera-Frame decodieren | ~40 KB | `vendor/jsqr/jsQR.js`, globale Funktion `jsQR(...)` |

Beide reines JS ohne Abhängigkeiten, funktionieren identisch auf iOS Safari und Android Chrome
(im Gegensatz zur nativen `BarcodeDetector`-API, die auf iOS Safari fehlt).

Kamera-Zugriff über `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`.
Erfordert HTTPS — bereits durch GitHub Pages gegeben.

---

## Datenmodell

### Neues Feld: `ersteller`

Jeder Schüler-Cache (`rsh_student_caches`) bekommt beim Speichern ein zusätzliches Feld
`ersteller` (String) = aktueller lokaler Username. Bestehende Einträge ohne dieses Feld werden
beim Laden als `ersteller: null` behandelt (keine Sonderbehandlung nötig, Badge zeigt dann
einfach „eigener").

### ID-Schema (geändert)

Bisher: `student-01`, `student-02`, … (pro Gerät fortlaufend, kollidiert beim Import zwischen
Geräten).

Neu: `student-<username-slug>-<4-stelliger-zufallshex>`, z. B. `student-mira-a8f3`.

- **Slug:** Username lowercased, alles außer `a-z0-9` entfernt, auf 12 Zeichen gekürzt. Leerer
  Slug (z. B. bei reinen Emoji-Namen) → Fallback `"schueler"`.
- **Zufallshex:** 4 Hex-Zeichen (`Math.random().toString(16)`), praktisch kollisionsfrei für
  Klassengröße.
- Implementiert als neue pure Funktion `generateStudentId(username)` in `js/caches.js`
  (ersetzt bisherige zähler-basierte Version).

### QR-Payload

```json
{"rshCache":1,"id":"student-mira-a8f3","name":"Am Baum","beschreibung":"Hinter der Bank",
 "codewort":"Eiche","latitude":51.389567,"longitude":7.702367,"ersteller":"Mira"}
```

- `rshCache: 1` als Marker-Feld: Scanner prüft dieses Feld zuerst; fehlt es, wird der QR-Code
  als „kein gültiger Cache-Code" abgelehnt, statt einen Fehler zu werfen.
- Payload-Größe ~150–250 Bytes, passt bequem in einen einzelnen QR-Code (Fehlerkorrektur-Level
  M), kein Chunking über mehrere Codes nötig.
- Neue pure Funktionen in neuem Modul `js/qr.js`: `encodeCacheQrPayload(cache)` und
  `decodeCacheQrPayload(text)` (wirft bei ungültigem/fremdem Text, damit der Scan-Code die
  Fehlermeldung anzeigen kann). Eigenes Modul statt Erweiterung von `js/caches.js`, damit
  QR-Encoding sauber von Cache-Datenverwaltung getrennt bleibt.

---

## Username-Onboarding

### Neue View: `#view-username`

Erscheint einmalig nach der Regeln-Bestätigung, vor der Cache-Liste (Reihenfolge in `app.js`:
`rules` → `username` (falls `rsh_username` leer) → `list`).

**Inhalt:** Kurzer Erklärtext „Wie heißt du? Dein Name wird angezeigt, wenn du Caches mit
anderen teilst." + Textfeld + Button „Los geht's".

**Validierung:** Nicht leer (getrimmt). Kein Format-Zwang, keine Eindeutigkeitsprüfung
(Kollisionsschutz kommt vom Zufalls-Suffix in der ID, nicht vom Namen).

**Speichern:** `localStorage.setItem('rsh_username', name)`, dann `showView('list')`.

### Name später ändern

Kleiner Link „Name: {username} (ändern)" unten in der Regeln-Ansicht (`#view-rules`).
Klick öffnet `prompt('Neuer Name:', aktuellerName)` — bewusst einfach gehalten (analog zu den
bestehenden `confirm()`-Dialogen in diesem Bereich), da es ein seltener Pfad ist. Leerer/
abgebrochener Prompt ändert nichts.

---

## Schüler-Flow

### Cache-Liste (Änderungen ggü. bestehender Lokale-Cache-Eingabe-Spec)

- Über der Liste stehen jetzt **zwei** Buttons nebeneinander: `+ Neuer Cache` und
  `📷 Scannen`.
- Jeder eigene Cache-Eintrag (`isStudent: true`) bekommt zusätzlich zum ✏️-Icon ein
  **📤-Icon** („Teilen").
- Badge-Text: „eigener" wenn `cache.ersteller === lokaler Username` (oder `ersteller` fehlt),
  sonst „von {ersteller}".
- Importierte Caches sind wie eigene Caches bearbeitbar/löschbar (rein lokale Kopie, keine
  Auswirkung auf das Ursprungsgerät).

### Neue View: `#view-share`

Geöffnet über 📤 an einem Cache-Eintrag.

- Vollbild-View analog zu `#view-detail` (Header/Bottom-Nav ausgeblendet, eigene Topbar mit
  `‹ Zurück`).
- Zeigt: Cache-Name, „von {ersteller}", großer QR-Code (per `qrcode-generator` in ein
  `<canvas>` oder `<div>` gerendert), Hinweistext „Lass jemanden diesen Code scannen, um den
  Cache zu übernehmen".
- Kein Speichern/Bearbeiten hier — reine Anzeige.

### Neue View: `#view-scan`

Geöffnet über `📷 Scannen` oberhalb der Liste.

- Vollbild-View, eigene Topbar mit `‹ Zurück`.
- `<video>`-Element zeigt Kamera-Stream (`getUserMedia`), ein `<canvas>` (unsichtbar) wird pro
  Frame per `requestAnimationFrame` mit dem aktuellen Video-Frame befüllt und an `jsQR()`
  übergeben.
- Bei erkanntem, gültigem Cache-QR:
  1. Kamera-Stream stoppen (`track.stop()`)
  2. Prüfen, ob `id` bereits in `rsh_student_caches` existiert → falls ja: Hinweis „Cache
     schon vorhanden", zurück zur Liste (kein Duplikat)
  3. Falls nein: Cache zu `rsh_student_caches` hinzufügen (inkl. `ersteller` aus Payload),
     kurze Erfolgsmeldung „„{Name}" übernommen!", zurück zur Liste (neu geladen)
- Bei erkanntem, aber ungültigem QR-Code (kein `rshCache`-Marker): Hinweistext „Kein gültiger
  Cache-Code", Scan läuft weiter (kein Abbruch).
- Bei verweigerter Kamera-Berechtigung: Fehlertext mit Hinweis, den Kamera-Zugriff in den
  Browser-Einstellungen zu erlauben, plus `‹ Zurück`.

---

## Lehrer-Flow (`lehrer.html` / `js/admin.js`)

- Neuer Button `📷 Scannen` im Caches-Tab, neben `+ Neuer Cache`.
- Öffnet ein Overlay-Modal (analog zu `showExportModal`) mit Kamera-Vorschau und derselben
  Scan-Logik wie im Schüler-Flow (gleiche `decodeCacheQrPayload()`-Funktion, wiederverwendet).
- Bei erkanntem gültigem Cache-QR: Modal schließt, `renderCacheForm(...)` öffnet sich
  **vorbefüllt** mit Name/Beschreibung/Codewort/Koordinaten aus dem Scan — aber mit einer
  **neuen**, admin-generierten ID (`generateId(adminCaches)`, bestehendes Schema `cache-NN`),
  nicht mit der gescannten Schüler-ID. Der `ersteller`-Wert wird nicht übernommen (offizielle
  Caches haben kein Ersteller-Feld).
- Lehrer prüft/passt die Felder wie gewohnt an und speichert über den bestehenden
  „Speichern"-Button — landet in `rsh_caches_admin`, wie jede andere Admin-Änderung.
- Kein automatisches Schreiben nach GitHub (siehe „Ziel" oben).

---

## Fehlerbehandlung

| Fall | Verhalten |
|------|-----------|
| Kamera-Berechtigung verweigert | Fehlertext + Anleitung, kein Absturz |
| QR-Code ohne `rshCache`-Marker | „Kein gültiger Cache-Code", Scan läuft weiter |
| Gescannte `id` existiert bereits lokal | „Cache schon vorhanden", kein Duplikat, kein Fehler |
| Kein `getUserMedia`-Support (sehr alter Browser) | Hinweistext „Scannen wird auf diesem Gerät nicht unterstützt" statt Absturz |

---

## Tests (Node `--test`, reine Logik ohne Kamera/DOM)

- `generateStudentId(username)`: Slug-Bildung (Sonderzeichen, Länge, leerer Slug-Fallback),
  Format der zusammengesetzten ID
- `encodeCacheQrPayload(cache)` / `decodeCacheQrPayload(text)`: Roundtrip, Ablehnung von Text
  ohne `rshCache`-Marker, Ablehnung von kaputtem JSON
- Duplikat-Erkennung (reine Merge-Logik, ohne echten Scan)

Kamera/QR-Scan selbst (Live-Decoding aus Video-Stream) ist nur manuell im Browser
verifizierbar, wie bereits bei GPS/Kompass-Funktionen in diesem Projekt üblich.

---

## Dateien

| Datei | Änderung |
|-------|----------|
| `vendor/qrcode/qrcode.js` | Neu: vendorte QR-Encode-Library |
| `vendor/jsqr/jsQR.js` | Neu: vendorte QR-Decode-Library |
| `js/qr.js` | Neu: `encodeCacheQrPayload()`, `decodeCacheQrPayload()` (pure Funktionen) |
| `tests/qr.test.js` | Tests für `js/qr.js` |
| `js/caches.js` | `generateStudentId()` auf Username-Slug + Zufallshex umgestellt |
| `tests/caches.test.js` | Tests für neues `generateStudentId()`-Format erweitert |
| `js/username.js` | Neu: Onboarding-View-Logik (analog zu `rules.js`/`cache-editor.js`) |
| `js/share.js` | Neu: Teilen-View-Logik (QR rendern) |
| `js/scan.js` | Neu: Scan-View-Logik (Kamera + `jsQR`-Loop), von Schüler- **und** Lehrer-Flow genutzt |
| `js/cache-editor.js` | 📤-Icon-Handling ergänzen (öffnet `share`-View) |
| `js/rules.js` | „Name ändern"-Link ergänzen |
| `index.html` | `#view-username`, `#view-share`, `#view-scan` Sections; neue `<script>`-Tags für Vendor-Libs + neue Module |
| `css/style.css` | Styles für neue Views (Topbar-Varianten existieren bereits, QR-Container, Kamera-Vorschau) |
| `js/app.js` | `VIEWS` erweitert; `showView()`-Übergänge; Buttons/Icons in `renderList()`; Callbacks für share/scan |
| `js/admin.js` | `📷 Scannen`-Button + Modal im Caches-Tab; Vorbefüllung von `renderCacheForm()` |
| `lehrer.html` | Neue `<script>`-Tags für Vendor-Libs + `scan.js` |
| `service-worker.js` | Cache-Version bump (nächste freie Nummer nach v14) |

---

## Was unverändert bleibt

- Automatischer GitHub-Sync ist **nicht** Teil dieses Designs (separates, noch nicht
  beschlossenes Feature)
- Server-Caches bleiben in der Schüler-App readonly
- Fortschritt (erledigt, Fotos) funktioniert für importierte Caches genauso wie für eigene
- Bestehende `rsh_student_caches`-Einträge ohne `ersteller`-Feld bleiben gültig (Badge zeigt
  „eigener")
