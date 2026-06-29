# Navigationsseite – Redesign & Fehlerbehebungen

**Datum:** 2026-06-29
**Betrifft:** Detail-/Navigationsansicht eines einzelnen Caches (`js/detail.js`, zugehörig `js/location.js`, `js/geo.js`, `css/style.css`, `index.html`)

## Ziel

Die Navigationsseite (Weg zu einem einzelnen Cache) wird zu einer **Vollbild-Karte mit zwei Bedienleisten** umgebaut und um Linien-/Spur-Anzeige sowie ein eigenes Log-Fenster erweitert. Zusätzlich werden zwei Kompass-/Pfeil-Fehler behoben.

Die Übersichtsansichten (Liste, Gesamtkarte, Regeln) bleiben unverändert.

## Änderungswünsche (Überblick)

| # | Wunsch | Art |
|---|--------|-----|
| A | Pfeil zeigt nur korrekt, wenn das Gerät beim Laden nach Norden zeigt | Bugfix Kompass |
| B | Pfeil springt an einer Stelle 359° zurück statt weiterzudrehen | Bugfix Rotation |
| C | Karte initial so gezoomt, dass Standort **und** Cache sichtbar sind | Karten-Zoom |
| D | Karte füllt den Bildschirm; übrige UI als Overlay-Leisten | Layout-Umbau |
| E | Linie vom aktuellen Standort zum Cache (Luftlinie) | Karten-Feature |
| F | Seit Öffnen des Caches zurückgelegter Weg auf der Karte | Karten-Feature |
| G | „Log"-Button öffnet Vollbild-Fenster: Foto, Codewort, Prüfen → Gefunden | Layout/Flow |
| H | Overlay-Buttons auf der Karte: Zoom + / Zoom − / Zentrieren auf Standort | Karten-Bedienung |
| I | Info-Button (i) in der oberen Leiste zeigt die Cache-Beschreibung | Karten-Bedienung |

## Layout (D)

Vollbild-Karte. Darüber zwei durchgehende, leicht transparente Leisten (`rgba(255,255,255,.94)`):

- **Obere Leiste:** Cachename (links, bündig, gekürzt mit Ellipsis) · Entfernung · Richtungspfeil · Info-Button (i) (rechts).
- **Untere Leiste:** „‹ Zurück" (links) · grüner „Log"-Button (rechts).
- **Dazwischen:** die Karte im Vollbild mit Luftlinie (E) und zurückgelegtem Weg (F).

Am rechten Kartenrand (zwischen den Leisten) liegen drei runde Overlay-Buttons übereinander (siehe H).

Die globale App-Kopfzeile (`.app-header`) und die globale untere Navigation (`.bottom-nav`) werden **in der Detailansicht ausgeblendet**, damit die Karte wirklich den Bildschirm füllt. Sie erscheinen wieder, sobald man über „Zurück" zur Liste/Karte wechselt. Beim Verlassen der Detailansicht wird die Heading-Anzeige nicht mehr benötigt.

Der Richtungspfeil ist eine **SVG-Pfeilform** (kräftige Farbe, weißer Rand), kein Emoji – Emojis werden nicht zuverlässig gerendert.

**Info-Button (i):** rechts in der oberen Leiste. Ein Tipp öffnet ein kleines Overlay/Dialog mit der **Cache-Beschreibung/dem Hinweis**, sodass der Tipp während der Suche jederzeit abrufbar ist, ohne die Karte dauerhaft zu verdecken. Erneutes Tippen bzw. ein Schließen-„×" blendet es wieder aus.

## Kompass-Fix (A) – absolute Nordausrichtung

**Problem:** `event.alpha` aus `deviceorientation` ist auf vielen Android-Geräten *relativ* zur Geräteausrichtung beim ersten Event, nicht absolut zu Norden. Dadurch stimmt der Pfeil nur, wenn das Gerät beim Laden zufällig nach Norden zeigt.

**Lösung in `js/location.js`:**
- Bevorzugt das `deviceorientationabsolute`-Event abonnieren (liefert absolute Werte zu Norden). Fällt auf `deviceorientation` zurück, wenn nicht verfügbar.
- iOS: weiterhin `event.webkitCompassHeading` (bereits absolut, 0 = Nord).
- Android-Fallback: `event.alpha` nur verwenden, wenn `event.absolute === true`; Heading = `(360 - alpha) % 360`.

**Bekannte Einschränkung:** Absolute Kompassdaten erfordern HTTPS und einen kalibrierten Magnetsensor; auf Geräten ohne Magnetometer bleibt der Pfeil ggf. ungenau. Das ist eine Hardware-/Browser-Grenze, kein App-Fehler. Bei fehlendem Heading wird der Pfeil weiterhin angezeigt, dreht sich aber nicht.

## Rotations-Fix (B) – stetige Drehung

**Problem:** `renderArrow` setzt `rotate((target - heading + 360) % 360)`. Beim Übergang von z. B. 358° auf 2° dreht das DOM-Element optisch 356° **rückwärts** statt 4° vorwärts.

**Lösung in `js/detail.js`:** Fortlaufenden (nicht modulo-begrenzten) Drehwinkel führen. Aus dem alten angewandten Winkel und dem neuen Zielwinkel die **kürzeste Winkeldifferenz** (`-180…+180`) berechnen und auf den fortlaufenden Wert addieren. So nimmt die CSS-Rotation immer den kurzen Weg, ohne Rücksprung.

## Karten-Zoom (C)

Beim Öffnen der Navigationsseite die Karte **einmalig** so einpassen, dass aktueller Standort und Cache mit Rand sichtbar sind (`fitBounds([user, cache], { padding })`). Liegt beim Öffnen noch kein GPS-Fix vor, wird eingepasst, sobald der erste Fix eintrifft. Danach bleibt die Karte in Ruhe – manuelles Zoomen/Verschieben wird nicht überschrieben (vorhandenes `miniFitted`-Verhalten bleibt erhalten).

## Luftlinie (E)

Eine Leaflet-`Polyline` vom Nutzer- zum Cache-Marker, gestrichelt, in der dunklen Cache-Farbe. Aktualisiert die Nutzer-Endpunkt-Koordinate bei jedem GPS-Update.

## Zurückgelegter Weg (F)

Beim Öffnen der Navigationsseite startet eine **leere** Spur. Jeder neue GPS-Fix hängt einen Punkt an eine `Polyline` (orange, deckend) an. Beim erneuten Öffnen (oder Cache-Wechsel) wird die Spur zurückgesetzt – sie zeigt nur den Weg der aktuellen Suche. Keine dauerhafte Speicherung in IndexedDB.

Optional zur Vermeidung von Zacken durch GPS-Rauschen: nur Punkte aufnehmen, die mehr als wenige Meter vom letzten entfernt sind (kleiner Schwellwert, z. B. 3 m). Wird in der Umsetzung als einfache Hilfsfunktion ergänzt.

## Karten-Bedienelemente (H)

Drei runde Overlay-Buttons am rechten Kartenrand, vertikal gestapelt oberhalb der unteren Leiste:

- **Zoom + / Zoom −:** rufen `map.zoomIn()` / `map.zoomOut()` auf. Die eingebaute Leaflet-Zoomsteuerung (`zoomControl`) wird abgeschaltet, damit Stil und Position zu den übrigen Overlays passen.
- **Zentrieren auf Standort:** schwenkt die Karte auf die aktuelle Nutzerposition (`setView(userLatLng, …)` bei aktuellem Zoom). Ist noch kein GPS-Fix vorhanden, ist der Button inaktiv/ohne Wirkung.

Einheitlicher Stil mit den übrigen Overlays (heller, halbtransparenter Hintergrund, Schatten), groß genug für Finger (Touch-Targets ≈ 44 px).

## Log-Fenster (G)

Der „Log"-Button öffnet eine **Vollbild-Ansicht** über der Karte mit eigenem „‹ Zurück"-Button. Inhalt:

1. **Foto aufnehmen** (vorhandener Datei-Input mit `capture="environment"`), darunter die Miniaturansichten bereits aufgenommener Fotos.
2. **Codewort vom Zettel** (Texteingabe).
3. **Prüfen → Gefunden** (Button). Bei Erfolg: `markDone`, Erfolgsmeldung („✅ Cache gefunden!") **bleibt im Log-Fenster stehen**; der Nutzer schließt es selbst über „Zurück". Bei Fehleingabe: Hinweistext, Fenster bleibt offen.
Die Cache-Beschreibung wird **nicht** im Log-Fenster gezeigt, sondern ist über den Info-Button (i) in der oberen Leiste der Navigationskarte erreichbar (siehe Layout).

Nach „Zurück" landet man wieder auf der Navigationskarte. Ist der Cache bereits gefunden, zeigt das Log-Fenster den Gefunden-Zustand (Erfolgsmeldung + Fotos) statt der Eingabefelder. Beim Zurückkehren zur Übersicht wird der Cache wie bisher als gefunden markiert (Liste/Gesamtkarte aktualisieren sich über den vorhandenen `onChanged('done')`-Mechanismus).

## Komponenten & Datenfluss

- **`index.html`:** Detail-Ansicht erhält Vollbild-Karten-Container plus obere/untere Leiste; separater Container/Markup für das Log-Vollbild-Fenster.
- **`js/detail.js`:** Aufbau der zwei Leisten; Pfeil-Rotation (B); `fitBounds` (C); Luftlinie (E); Spur-Aufzeichnung (F); Öffnen/Schließen und Inhalt des Log-Fensters (G); Overlay-Buttons Zoom/Zentrieren (H). Erhält weiterhin GPS- und Heading-Updates über `updateDetailLocation` / `updateDetailHeading`.
- **`js/location.js`:** absolute Heading-Quelle (A).
- **`js/app.js`:** blendet `.app-header` und `.bottom-nav` beim Wechsel in/aus der Detailansicht ein/aus.
- **`css/style.css`:** Stile für Vollbild-Karte, Leisten, Pfeil, Log-Fenster.
- **`js/geo.js`:** unverändert (reine Mathematik); ggf. kleine Hilfsfunktion für kürzeste Winkeldifferenz, falls testbar getrennt sinnvoll.

## Tests

- **`js/geo.js`-nahe Logik:** Funktion für die kürzeste Winkeldifferenz (B) als reine Funktion mit Unit-Tests (u. a. 358°→2° ergibt +4°, nicht −356°).
- **Heading-Normalisierung (A):** reine Hilfsfunktion (alpha→heading, absolut/relativ) mit Unit-Tests, falls aus `location.js` extrahierbar.
- Karten-, Linien-, Spur- und Log-UI werden manuell im Browser/auf dem Smartphone verifiziert (Leaflet/DeviceOrientation lassen sich in den vorhandenen Node-Tests nicht sinnvoll abdecken).

## Bewusst nicht enthalten (YAGNI)

- Keine dauerhafte Speicherung der zurückgelegten Spur.
- Keine Routenführung über Wege (nur Luftlinie).
- Keine Änderungen an Liste, Gesamtkarte oder Regeln.
- Kein Umbau des Foto-/Codewort-Speichers (`progress.js` bleibt wie er ist).
