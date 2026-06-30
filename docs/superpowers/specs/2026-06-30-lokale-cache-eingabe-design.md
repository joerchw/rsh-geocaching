# Lokale Cache-Eingabe (Schüler-App) — Design Spec

## Ziel

Schüler können in der Schüler-App eigene Caches anlegen, bearbeiten und löschen. Diese Caches
existieren nur lokal auf dem Gerät (`localStorage`) und erscheinen nahtlos in der bestehenden
Cache-Liste neben den Server-Caches.

---

## Datenspeicherung

| Schlüssel | Inhalt | Wer schreibt |
|-----------|--------|--------------|
| `rsh_caches_admin` | Lehrer-Override der Server-Caches | nur lehrer.html |
| `rsh_student_caches` | Schüler-eigene Caches | nur index.html (dieses Feature) |

Student-Caches verwenden das gleiche JSON-Schema wie `caches.json`, plus ein internes Flag
`isStudent: true`. Dieses Flag wird **nicht** in `rsh_student_caches` gespeichert, sondern beim
Laden dynamisch hinzugefügt.

**ID-Schema:** `student-01`, `student-02`, … — Präfix verhindert Kollisionen mit Server-IDs.

### Ladereihenfolge (`loadCaches()`)

1. Server-/Lehrer-Caches laden (wie bisher: `rsh_caches_admin` → Fallback `data/caches.json`)
2. `rsh_student_caches` laden
3. Student-Caches mit `isStudent: true` markieren
4. Beide Arrays zusammenführen → eine Liste, die `app.js` wie bisher nach Distanz sortiert

---

## Koordinatenformate

Beide Formate werden beim Speichern automatisch erkannt und in Dezimalgrad umgerechnet
(was Leaflet und die GPS-API liefern). In den Formularfeldern werden beim Öffnen immer
Dezimalgrad angezeigt.

### Dezimalgrad (DD)
- `51.389567` — Punkt als Dezimaltrennzeichen
- `51,389567` — Komma als Dezimaltrennzeichen (deutsche Tastatur)
- Negatives Vorzeichen für Süd/West: `-51.389567`

### Grad Dezimalminuten (GDM)
- `N 51° 23.374′` — mit Himmelsrichtung als Präfix
- `51° 23.374′ N` — mit Himmelsrichtung als Suffix
- `N51 23.374` — ohne Sonderzeichen, Leerzeichen als Trenner
- `51°23.374` — ohne Leerzeichen, ohne Himmelsrichtung (dann positiv)
- Komma statt Punkt im Minutenanteil ebenfalls akzeptiert

**Vorzeichen-Regel:** N/E → positiv, S/W → negativ. Kein N/S/E/W → positiv.

**Wo implementiert:** Neue pure Funktion `parseCoordinate(str)` in `js/geo.js`, gibt
Dezimalgrad als `number` zurück oder `null` bei ungültigem Format. Wird in `cache-editor.js`
zur Validierung und Umrechnung verwendet.

**Hinweistext** unter den Koordinatenfeldern:
`z. B. 51.389567 oder N 51° 23.374′`

---

## UI-Ablauf

### Listen-Ansicht (Änderungen)

- **Eigene Caches** erhalten in der Liste ein kleines gelbes Badge „eigener" und ein ✏️-Icon
  am rechten Rand.
  - Tippen auf den Listeneintrag → Navigation öffnen (wie bisher)
  - Tippen auf ✏️ → Editor-View öffnen (Bearbeiten-Modus)
- **Letzter Eintrag** in der Liste: `+ Neuer Cache` (gestrichelte grüne Rahmung).
  - Tippen → Editor-View öffnen (Neu-Modus)

### Editor-View (`#view-cache-editor`)

Vollbild-View analog zu `#view-detail`: App-Header und Bottom-Nav werden ausgeblendet;
der View hat eine eigene grüne Topbar.

**Topbar:** `‹ Zurück` (links) · Titel „Neuer Cache" oder „Cache bearbeiten" (Mitte/rechts)

**Formularfelder:**
- Name (`<input>`)
- Beschreibung (`<textarea>`, 2 Zeilen)
- Codewort (`<input>`)
- Breitengrad (`<input>`) + Längengrad (`<input>`) nebeneinander
- Hinweistext unter den Koordinatenfeldern
- `📍 GPS-Position übernehmen` (Button, volle Breite, überschreibt beide Felder)
- Fehlermeldung (rot, versteckt bis Validierung schlägt fehl)

**Buttons (unterhalb des Formulars):**
- `Speichern` (primär, grün) — immer sichtbar
- `🗑️ Cache löschen` (rot, Rahmen) — **nur im Bearbeiten-Modus**

**Speichern-Aktion:**
1. `parseCoordinate()` auf beide Koordinatenfelder anwenden
2. Pflichtfelder prüfen (Name, Beschreibung, Codewort nicht leer; Koordinaten gültig)
3. Bei Fehler: Fehlermeldung anzeigen, nicht speichern
4. Bei Erfolg: `saveStudentCaches()`, Callback `'saved'` → Liste neu laden, zurück zur Liste

**Löschen-Aktion:**
1. `confirm('Cache „[Name]" wirklich löschen?')` — bei Abbruch nichts tun
2. Bei Bestätigung: `saveStudentCaches()` ohne diesen Eintrag, Callback `'deleted'` → Liste
   neu laden, zurück zur Liste

**Zurück-Button:** zurück zur Liste ohne Speichern (kein confirm, da nichts verloren geht —
Server-Caches sind readonly, eigene Änderungen werden erst beim Speichern übernommen)

---

## Dateien

| Datei | Änderung |
|-------|----------|
| `js/geo.js` | Neue Funktion `parseCoordinate(str)` (pure, exportiert) |
| `tests/geo.test.js` | Tests für `parseCoordinate()` |
| `js/caches.js` | `loadStudentCaches()`, `saveStudentCaches()`, `generateStudentId()`, `loadCaches()` erweitert |
| `tests/caches.test.js` | Tests für neue Caches-Funktionen |
| `js/cache-editor.js` | Neu: Editor-View-Logik (analog zu `detail.js`) |
| `index.html` | `#view-cache-editor` Section; `cache-editor.js` importieren |
| `css/style.css` | Styles für Editor-Topbar, Body, Coord-Hint, Danger-Button |
| `js/app.js` | `'cache-editor'` in VIEWS; `showView()` erweitert; Liste neu; Editor-Callbacks |
| `service-worker.js` | Cache-Version v13 |

---

## Was unverändert bleibt

- Server-Caches sind in der Schüler-App readonly (kein Edit/Delete)
- Fortschritt (erledigt, Fotos) funktioniert für eigene Caches genauso wie für Server-Caches
- `lehrer.html` / `admin.js` werden nicht angefasst
- Eigene Caches werden **nicht** über GitHub synchronisiert — sie bleiben lokal
