# RSH Geocaching — Design-Dokument

**Datum:** 2026-06-28
**Plattform:** Progressive Web App (PWA) — plattformunabhängig, läuft im Browser auf
iOS und Android (Geräte ab ~2015: iPhone 6s+, Android 6/7+)
**Nutzung:** Projektwoche Geocaching, Realschule am Hemberg
**Verteilung:** Aufruf per Link / QR-Code im Browser, optional „zum Startbildschirm hinzufügen"

---

## Übersicht

RSH Geocaching ist eine Web-App (PWA) für die Projektwoche Geocaching an der Realschule
am Hemberg. Lehrer verstecken Caches (Dosen mit einem Zettel) in Schulnähe. Schüler öffnen
die Seite auf dem Smartphone (per QR-Code), um die Caches zu finden: Sie sehen die Caches
als Liste und auf einer Karte, navigieren per Live-Entfernung zum Ziel, bestätigen den Fund
durch Eingabe eines Codeworts vom Zettel in der Dose und legen ein Foto als Erinnerung ab.
Erledigte Caches werden in der Liste markiert.

Eine Web-App wurde gegenüber einer nativen Android-App gewählt, weil sie **iOS und Android
mit einer einzigen Codebasis** abdeckt (der ursprüngliche Wunsch war beide Plattformen),
ohne App-Store, Apple-Entwicklerkonto oder APK-Sideloading. Die Verteilung an eine Schulklasse
ist denkbar einfach: ein Link bzw. QR-Code.

---

## Technik-Stack

| Bereich | Wahl |
|---|---|
| Grundlage | HTML + CSS + **Vanilla JavaScript** (kein Build-Werkzeug, keine Toolchain) |
| App-Typ | PWA (Web App Manifest + Service Worker, „zum Startbildschirm hinzufügen") |
| Karte | **Leaflet.js** mit OpenStreetMap-Tiles |
| Offline-Karte | vorab erzeugte Tiles (~2×2 km) im Projekt, vom Service Worker gecacht; Online-OSM-Fallback außerhalb |
| Standort | `navigator.geolocation` (HTTPS erforderlich) |
| Richtung (optional) | `DeviceOrientation` API (auf iOS mit Erlaubnis-Tipp) |
| Foto aufnehmen | `<input type="file" accept="image/*" capture="environment">` |
| Cache-Daten | `caches.json` (statische Datei, von Lehrern editierbar) |
| Fortschritt + Fotos | lokal im Browser via **IndexedDB** |
| Hosting | statische Seite — Cloudflare Pages (Test), optional Schul-Server (final) |

**Bewusst weggelassen:** kein Backend, keine Datenbank, keine Anmeldung, keine Frameworks,
kein Build-Schritt. Die Seite besteht aus statischen Dateien, die auf jeden HTTPS-Webspace
kopiert werden können. Das hält die App wartbar (auch für Lehrer) und lauffähig auf älteren
Browsern.

**Browser-Anforderungen:** moderner mobiler Browser (Safari ab iOS 11.3, Chrome/Android-WebView
ab ~2017). Service Worker und Geolocation sind seit Jahren überall verfügbar.

---

## UI / Design

Die App soll am Internetauftritt und Logo der Realschule am Hemberg angelehnt sein.

**Schulfarben (aus dem Logo `rsh_logo_original.png`):**

| Rolle | Farbe | Hex (Startwert) |
|---|---|---|
| Primär (Logo „REALSCHULE") | Grün | `#62B24F` |
| Akzent (Logo-Block, „STARK für die ZUKUNFT") | Blau | `#6E9AC8` |
| Dunkelblau (Logo-Block) | Dunkelblau | `#2F4D6E` |
| Dunkelgrün (Logo-Block) | Dunkelgrün | `#3C8A5B` |
| Neutral (Logo „am Hemberg") | Grau | `#9E9E9E` |
| Hintergrund | Weiß | `#FFFFFF` |

Die Farben liegen zentral als CSS-Custom-Properties (`:root { --rsh-gruen: … }`) in einer
Stylesheet-Datei und werden nach der Testphase mit den finalen Schulfarben justiert.

**Lesbarkeit im Freien (Außeneinsatz bei Sonnenlicht):**

- **Hoher Kontrast:** Für Text und Buttons werden die kräftigen/dunklen Varianten
  (Dunkelgrün `#3C8A5B`, Dunkelblau `#2F4D6E`) auf weißem Grund verwendet. Die hellen
  Logotöne nur als dezente Flächenakzente.
- **Große Schrift & große Touch-Flächen:** Wichtige Werte (insbesondere die Entfernung)
  werden sehr groß dargestellt, gut erfassbar mit ausgestrecktem Arm.
- **Heller Hintergrund** (kein Dark Mode) — draußen besser lesbar.
- **Keine** automatische Helligkeitssteuerung — die Schüler regeln die Bildschirmhelligkeit
  bei Bedarf selbst.
- **Responsives Layout** für unterschiedliche Bildschirmgrößen; Hochformat als Standard.

---

## Screens & Navigation

Single-Page-App; „Screens" sind Ansichten innerhalb der Seite (kein Neuladen).

```
[Start/Regeln] → [Cache-Liste] ⇄ [Karte]
                       ↓
                 [Cache-Detail] → [Foto aufnehmen]
                       ↓
                 [Codewort eingeben → Gefunden!]
```

### 1. Start-/Regel-Ansicht

- Wird beim ersten Öffnen angezeigt.
- Drei Abschnitte: **Geocaching-Regeln**, **Sicherheit**, **Umwelt** (Texte s. u.).
- Button „Verstanden – los geht's". Bestätigung wird lokal gemerkt; später über ein Menü
  erneut aufrufbar.

### 2. Cache-Liste (Start nach den Regeln)

- Einträge je Cache: Name, kurze Beschreibung, **Luftlinien-Entfernung** (groß),
  Status-Badge (✅ erledigt / ⬜ offen).
- Sortiert nach Entfernung (nächster zuerst).
- Umschalter oben: **Liste | Karte**.
- GPS-Status-Hinweis (aktiv / wird gesucht / kein Standort).

### 3. Karte

- Leaflet-Karte: eigener Standort als blauer Punkt, Cache-Marker (offen/erledigt farblich
  unterscheidbar).
- Offline-Tiles im Schulbereich (~2×2 km), automatischer Online-OSM-Fallback außerhalb.
- Tippen auf einen Marker → Cache-Detail.

### 4. Cache-Detail

- Name, Beschreibung, **große Live-Entfernungsanzeige**; Richtungspfeil zum Ziel, sofern der
  Browser/das Gerät die Ausrichtung liefert (sonst nur Entfernung).
- Kleine Karte mit eigenem Standort + Ziel.
- Button **„Foto aufnehmen"** — öffnet die Kamera; Foto wird dem Cache lokal zugeordnet.
- Button **„Gefunden – Codewort eingeben"** → Eingabefeld. Bei korrektem Codewort wird der
  Cache als erledigt markiert (mit Bestätigung/Erfolg-Hinweis).
- Bereits aufgenommene Fotos des Caches werden hier angezeigt.

---

## Datenmodell & Datenfluss

### `caches.json` (statische Datei, von Lehrern editierbar)

```json
[
  {
    "id": "cache-01",
    "name": "Der alte Baum",
    "beschreibung": "Suche bei der großen Eiche am Waldrand.",
    "latitude": 51.1234,
    "longitude": 7.5678,
    "codewort": "Eichhörnchen"
  }
]
```

- `codewort`: Wird beim „Gefunden"-Eintrag geprüft. Der Vergleich ist **tippfehler-tolerant**:
  unabhängig von Groß-/Kleinschreibung und führenden/abschließenden Leerzeichen.

> **Hinweis Codewort-Sichtbarkeit:** In einer reinen Web-App liegt `caches.json` (inkl.
> Codewörter) technisch im Browser einsehbar vor. Für eine Schul-Projektwoche ist das
> akzeptabel — der Zettel in der Dose bleibt der eigentliche Beleg vor Ort, und der Aufwand,
> die Codewörter aus dem Quelltext zu fischen, ist höher als hinzulaufen. (Eine
> serverseitige Prüfung wäre die spätere „sichere" Variante, siehe Erweiterungen.)

### Lokaler Fortschritt (IndexedDB, pro Browser/Gerät)

Pro Cache-`id`:
- `erledigt` (ja/nein)
- Zeitpunkt der Erledigung
- zugehörige Fotos (als Blob in IndexedDB)

### Fotos

- Aufnahme über `<input capture>`; das Bild wird als Blob in IndexedDB gespeichert und dem
  Cache zugeordnet. Optional „Bild speichern" (Download) in die Geräte-Galerie.

### Datenfluss

1. Erstes Öffnen → Regeln → Cache-Liste.
2. `caches.json` wird geladen (und vom Service Worker offline vorgehalten).
3. GPS via `navigator.geolocation` (`watchPosition`); Entfernungen werden laufend neu
   berechnet (Luftlinie, Haversine-Formel).
4. Cache wählen → Detail zeigt Live-Entfernung (+ Richtungspfeil, falls verfügbar).
5. Foto aufnehmen → in IndexedDB gespeichert, dem Cache zugeordnet.
6. Codewort korrekt → Cache als erledigt markiert, Liste/Karte aktualisiert.

### Dateistruktur (statische Seite)

```
rsh-geocaching/
├── index.html              # App-Shell, alle Ansichten
├── css/
│   └── style.css           # Schulfarben (CSS-Variablen), Layout, Lesbarkeit
├── js/
│   ├── app.js              # Einstieg, Ansichts-Steuerung (Router)
│   ├── location.js         # Geolocation, Entfernung (Haversine), Ausrichtung
│   ├── caches.js           # caches.json laden
│   ├── map.js              # Leaflet-Karte, Offline-/Online-Tiles
│   ├── progress.js         # IndexedDB: erledigt + Fotos
│   ├── codeword.js         # Normalisierung + Prüfung
│   └── rules.js            # Regeltexte / Start-Ansicht
├── data/
│   └── caches.json         # Cache-Daten (Lehrer pflegen diese)
├── tiles/                  # vorab erzeugte Offline-Karten-Tiles (~2×2 km)
├── img/                    # Logo, Icons, Marker
├── manifest.webmanifest    # PWA-Manifest (Name, Icons, Farben)
└── service-worker.js       # Offline-Cache (App-Shell, Tiles, caches.json)
```

---

## Hosting & Verteilung

- **Statische Seite**, daher überall mit HTTPS hostbar.
- **Testphase:** Cloudflare Pages (kostenlos, HTTPS, schnelles CDN). Alternativen:
  GitHub Pages, Netlify, Vercel.
- **Final (optional):** Schul-Server `rsamhemberg.de`, falls HTTPS-Webspace verfügbar — dann
  bleiben alle Inhalte „im Haus".
- **HTTPS ist Pflicht** (Geolocation und Service Worker funktionieren nur über HTTPS; alle
  genannten Hoster liefern es kostenlos).
- **Verteilung an die Klasse:** QR-Code auf die URL; Schüler öffnen ihn und fügen die Seite
  optional zum Startbildschirm hinzu.

---

## Datenschutz

- Kein Backend, keine Datenbank, keine Anmeldung.
- Fotos und Fortschritt verbleiben **ausschließlich lokal** im Browser (IndexedDB) des
  Schülergeräts; es werden **keine personenbezogenen Daten übertragen**.
- Einzige externe Anfragen: OpenStreetMap-Tiles (nur außerhalb des Offline-Bereichs).
- Das ist datenschutztechnisch besonders unkritisch — relevant bei Minderjährigen.

---

## Berechtigungen (Browser-Abfragen)

| Abfrage | Zweck | Zeitpunkt |
|---|---|---|
| Standort | GPS für Entfernung und Karte | beim Start der Suche |
| Kamera | Foto am Fundort | bei erster Fotoaufnahme |
| Bewegungssensoren (iOS) | Richtungspfeil (optional) | bei erster Nutzung des Pfeils |

---

## Fehlerbehandlung

| Situation | Verhalten |
|---|---|
| Kein GPS-Signal / Standort verweigert | Hinweistext, Entfernung „wird ermittelt…"; Erklärung, wie man den Zugriff erlaubt |
| Kamera verweigert / nicht verfügbar | Hinweis; „Gefunden"-Eintrag bleibt ohne Foto möglich |
| Falsches Codewort | freundlicher Hinweis „Codewort stimmt nicht – schau nochmal auf den Zettel" |
| Offline + außerhalb des Tile-Bereichs | Karte zeigt leere/graue Tiles; Liste und Entfernung funktionieren weiter |
| `caches.json` fehlerhaft / nicht ladbar | verständliche Meldung statt „weißer Seite" |
| Browser ohne Ausrichtungssensor | Richtungspfeil ausgeblendet, Entfernung genügt zur Navigation |

---

## Testing

JavaScript-Unit-Tests (z. B. mit einem leichten Test-Runner ohne Build-Zwang) für die
plattformunabhängige Logik:

1. **Codewort-Prüfung** — Normalisierung (Groß-/Kleinschreibung, Leerzeichen), korrekt/falsch.
2. **Entfernungsberechnung** — Haversine-Formel gegen bekannte Referenzwerte.
3. **caches.json-Verarbeitung** — gültige und ungültige Eingaben.

Karte, GPS, Kamera, Offline-Verhalten und die iOS-Eigenheiten (Sensor-Erlaubnis,
Speicher) werden manuell auf echten Geräten (mind. je ein iOS- und ein Android-Gerät)
getestet.

---

## Regeltexte (Startentwurf — final nach Testphase)

### 🧭 Geocaching-Regeln

- Suche den Cache vorsichtig und unauffällig – andere müssen ihn auch noch finden können.
- Lege den Cache (die Dose) genau dort wieder zurück, wo du ihn gefunden hast, und verstecke
  ihn wieder gut.
- Nimm nichts aus der Dose heraus und lass den Zettel mit dem Codewort drin.
- Trage deinen Fund in der App ein und mach ein Foto als Erinnerung.
- Hab Geduld – manchmal ist ein Cache gut versteckt. Aufgeben gilt nicht gleich!

### ⚠️ Sicherheit

- Achte auf den Verkehr! Schau beim Gehen nicht nur aufs Handy.
- Bleibt als Gruppe zusammen und entfernt euch nicht vom vereinbarten Gebiet.
- Klettere nicht auf gefährliche Stellen (Mauern, Bäume, ans Wasser) – kein Cache ist ein
  Risiko wert.
- Bei Problemen oder wenn ihr euch verlaufen habt: Ruft eure Lehrerin oder euren Lehrer an.
- Achte auf das Wetter und zieh dich passend an.

### 🌳 Umwelt

- Hinterlasse die Natur so, wie du sie vorgefunden hast – nimm deinen Müll wieder mit.
- Bleib möglichst auf den Wegen und zertrample keine Pflanzen.
- Stör keine Tiere und respektiere ihren Lebensraum.
- Sei rücksichtsvoll zu anderen Menschen, die unterwegs sind.

---

## Zukünftige Erweiterungen (bewusst nicht im ersten Release)

- **Serverseitige Codewort-Prüfung** und **zentrale Fortschrittsübersicht** aller Gruppen
  für Lehrer (Backend nötig; ca. 2–3× Mehraufwand: Authentifizierung, Datenschutz für
  Minderjährige, Umgang mit schlechtem WLAN).
- **Lehrer-Alarm / SOS-Funktion** — Unterstützung anfordern bei Verlaufen oder Unfall.
- **Caches per Server pflegen** — `caches.json` zentral aktualisierbar ohne neues Deploy.
- **Native App** (Android/iOS), falls später tiefere Geräteintegration gewünscht ist.

---

## Offene Punkte für die Umsetzung (kein Blocker fürs Design)

- Genaue **Mittelpunkt-Koordinaten der Schule** und Ausdehnung/Zoomstufen für die
  Offline-Tiles (~2×2 km) festlegen und Tiles erzeugen.
- Erste echte **Cache-Daten** in `data/caches.json` (durch die Lehrer).
- Finalen **Hosting-Ort** wählen (Cloudflare Pages für Test; ggf. Schul-Server final).
