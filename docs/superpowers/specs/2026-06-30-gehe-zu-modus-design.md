# "Gehe zu"-Modus (Schüler-App) — Design Spec

## Ziel

Schüler können ein Navigationsziel direkt über Koordinaten eingeben — unabhängig von den
vorhandenen Caches (Server- oder eigene). Nach Eingabe der Koordinaten wechselt die App in die
bestehende Navigationsansicht (Karte, Richtungspfeil, Distanz) und führt zum eingegebenen Punkt.

---

## Einstieg

Vierter Button in der unteren Navigationsleiste: „📍 Gehe zu" (neben Liste, Karte, Regeln).
Öffnet die neue View `#view-goto`.

`#view-goto` ist eine reguläre View wie Liste/Karte/Regeln — App-Header und Bottom-Nav bleiben
sichtbar (im Gegensatz zur Vollbild-Navigationsansicht und zum Cache-Editor).

---

## Koordinaten-Formular (`#view-goto`)

**Felder:**
- Breitengrad (`<input>`)
- Längengrad (`<input>`)
- Hinweistext darunter: `z. B. 51.389567 oder N 51° 23.374′`
- Fehlermeldung (rot, versteckt bis Validierung fehlschlägt)

**Kein GPS-Button** — das Hauptszenario ist die Eingabe eines fremden, vorgegebenen Ziels.

**Vorausfüllung:** Beim Öffnen der View werden die Felder mit dem zuletzt erfolgreich
verwendeten Ziel vorausgefüllt (siehe Persistenz unten). Beim allerersten Aufruf (kein
gespeichertes Ziel) bleiben die Felder leer.

**Koordinatenformate:** Identisch zur Cache-Eingabe — Dezimalgrad (DD) und Grad-Dezimalminuten
(GDM), beide über die bestehende Funktion `parseCoordinate(str)` aus `js/geo.js` geparst. Keine
neue Parsing-Logik nötig.

**Button „Los geht's"** (primär, volle Breite):
1. `parseCoordinate()` auf beide Felder anwenden
2. Bei ungültiger Eingabe (eines oder beide Felder `null`): Fehlermeldung anzeigen, nicht
   fortfahren
3. Bei Erfolg:
   - Rohe Eingabe-Strings (nicht die geparsten Dezimalgrad-Werte) in `rsh_goto_target`
     speichern (`localStorage`) — so bleibt beim nächsten Öffnen exakt das eingegebene Format
     sichtbar
   - Synthetisches Ziel-Objekt bauen: `{ id: 'goto-target', name: 'Gehe zu', latitude, longitude,
     beschreibung: '', codewort: null }`
   - Navigationsansicht mit diesem Ziel öffnen (siehe unten)

---

## Navigationsansicht (Wiederverwendung von `#view-detail`)

Es wird **keine neue Navigationsansicht gebaut**. `renderDetail()` aus `js/detail.js` wird mit
dem synthetischen Ziel-Objekt aufgerufen — Karte, Richtungspfeil, Distanzanzeige und die
orangene Spur funktionieren unverändert, da sie nur `latitude`/`longitude` benötigen.

**Anpassungen in `renderDetail()`:**
- **Log-Button (`nav-log`)** wird ausgeblendet, wenn `cache.codewort` nicht gesetzt ist (`null`
  oder leer). In diesem Fall wird `renderLogBody()` auch nicht aufgerufen — so wird für das
  Gehe-zu-Ziel weder die Foto-/Codewort-UI verdrahtet noch `progress.js` (z. B. `isDone()`) für
  die synthetische ID `'goto-target'` angesprochen.
- **Info-Button (`nav-info`)** wird ausgeblendet, wenn `cache.beschreibung` leer ist.
- **Name-Anzeige (`nav-name`)** zeigt `cache.name` wie bisher — für das Gehe-zu-Ziel also
  „Gehe zu".

**Rücksprungziel des „Zurück"-Buttons:** Hierfür ist **keine Änderung an `detail.js` nötig**.
`wireControls()` verdrahtet den `nav-back`-Klick einmalig und ruft dabei immer den aktuell
gesetzten `onChanged`-Callback auf (`onChanged = onChangedCb` wird bei jedem `renderDetail()`-
Aufruf neu zugewiesen). `app.js` muss also nur beim Öffnen über „Gehe zu" einen Callback
übergeben, der bei `'back'` zu `showView('goto')` statt `showView('list')` springt — analog zum
bestehenden Muster bei `startCacheEditor()`.

**Was unverändert bleibt:** GPS-Tracking (`updateDetailLocation`), Kompass
(`updateDetailHeading`), Zoom-/Center-Steuerung, Karten-Initialisierung — all das ist bereits
generisch über `latitude`/`longitude` implementiert und braucht keine Anpassung.

---

## Persistenz

| Schlüssel | Inhalt | Wer schreibt |
|-----------|--------|--------------|
| `rsh_goto_target` | `{ latRaw: string, lonRaw: string }` — rohe Formular-Eingabe | nur `js/goto.js` |

Rein lokal, nicht über GitHub synchronisiert — wie auch `rsh_student_caches`. Das gespeicherte
Ziel ist kein Cache und erscheint nicht in der Cache-Liste.

---

## Dateien

| Datei | Änderung |
|-------|----------|
| `index.html` | `#view-goto` Section (Formular); 4. Button in `#bottom-nav`; `goto.js` importieren |
| `js/goto.js` | Neu: Formular-Logik (Öffnen, Vorausfüllen, Validieren, Speichern, Navigationsansicht starten) |
| `js/detail.js` | `renderDetail()`: Log-/Info-Button bedingt ausblenden, `renderLogBody()` bedingt überspringen |
| `js/app.js` | `'goto'` in `VIEWS`; `showView()` erweitert (Header/Bottom-Nav-Sichtbarkeit unverändert für `'goto'`, da reguläre View); `startGoto()`-Funktion mit eigenem `onChanged`-Callback (`'back'` → `showView('goto')`); 4. Bottom-Nav-Button verdrahten |
| `css/style.css` | Styles fürs Formular (Wiederverwendung der Cache-Editor-Klassen: `form-input`, Hinweistext, Fehlermeldung) |
| `service-worker.js` | Cache-Version v14; `js/goto.js` in `APP_SHELL` |

---

## Was unverändert bleibt

- Cache-Liste, Cache-Editor, Lehrer-App (`lehrer.html`/`admin.js`) werden nicht angefasst
- Fortschritt/Log-Funktionalität (`progress.js`) wird für das Gehe-zu-Ziel nicht aufgerufen —
  es gibt kein „Fund"-Konzept für ein Koordinatenziel ohne Codewort
- `parseCoordinate()` wird unverändert wiederverwendet, keine neue Parsing-Logik
