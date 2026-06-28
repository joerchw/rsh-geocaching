# RSH Geocaching — Design-Dokument

**Datum:** 2026-06-28
**Plattform:** Android (nativ, Kotlin), minSdk 24 (Android 7, Geräte ab ~2015)
**Nutzung:** Projektwoche Geocaching, Realschule am Hemberg (Sideloading per APK, kein Play Store)
**Vorlage:** orientiert an `D:\Joerg\Projekte\DrumRum` (gleicher Stack, ohne die Netz-Dienste Overpass/OSRM)

---

## Übersicht

RSH Geocaching ist eine Android-App für die Projektwoche Geocaching an der Realschule
am Hemberg. Lehrer verstecken Caches (Dosen mit einem Zettel) in Schulnähe. Schüler nutzen
die App, um die Caches zu finden: Sie sehen die Caches als Liste und auf einer Karte,
navigieren per Live-Entfernung und Richtungspfeil zum Ziel, bestätigen den Fund durch
Eingabe eines Codeworts vom Zettel in der Dose und legen ein Foto als Erinnerung ab.
Erledigte Caches werden in der Liste markiert.

Eine spätere iOS-Version ist ein separates Projekt. Cross-Platform (Flutter) würde den
bewährten DrumRum-Code verwerfen, daher bleibt die App nativ.

---

## Technik-Stack

| Bereich | Wahl |
|---|---|
| Sprache / UI | Kotlin + Jetpack Compose |
| Architektur-Muster | MVVM |
| Karte | OSMDroid — **offline** für ~2×2 km um die Schule, **Online-OSM-Fallback** außerhalb |
| Standort | FusedLocationProviderClient |
| Cache-Daten | `caches.json` im App-Bundle (von Lehrern editierbar) |
| Fortschritt | lokal auf dem Gerät (Jetpack DataStore) |
| Fotos | app-interner Speicher (`filesDir/photos/<cacheId>/`) |
| minSdk | 24 (Android 7) — deckt Geräte ab ~2015 ab |
| compileSdk / targetSdk | 36 (analog DrumRum) |
| Verteilung | Sideload per APK |

**Bibliotheken** (analog DrumRum):

| Bibliothek | Zweck |
|---|---|
| OSMDroid | Kartenanzeige (offline + online) |
| Moshi | JSON-Parsing der `caches.json` |
| Kotlin Coroutines | Asynchrone Operationen |
| AndroidX DataStore | Persistenz des Fortschritts |
| play-services-location | GPS-Standort |

Kein Backend, keine API-Keys, keine Google-Karten-Dienste. Dependency Injection (Hilt)
wird bewusst weggelassen — zu viel Overhead für den Projektumfang.

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

Die Farben liegen zentral in der Theme-Datei (`ui/theme/Color.kt`) und werden nach der
Testphase mit den finalen Schulfarben justiert.

**Lesbarkeit im Freien (Außeneinsatz bei Sonnenlicht):**

- **Hoher Kontrast:** Für Text und Buttons werden die kräftigen/dunklen Varianten
  (Dunkelgrün `#3C8A5B`, Dunkelblau `#2F4D6E`) auf weißem Grund verwendet. Die hellen
  Logotöne (Pastellblau, Hellgrün) nur als dezente Flächenakzente.
- **Große Schrift & große Touch-Flächen:** Wichtige Werte (insbesondere die Entfernung)
  werden sehr groß dargestellt, gut erfassbar mit ausgestrecktem Arm.
- **Kein Dark Mode** für die Hauptansichten — heller Hintergrund ist draußen besser lesbar.
- **Keine** automatische Helligkeitssteuerung — die Schüler regeln die Bildschirmhelligkeit
  bei Bedarf selbst.

---

## Screens & Navigation

```
[Start/Regeln] → [Cache-Liste] ⇄ [Karte]
                       ↓
                 [Cache-Detail] → [Foto aufnehmen]
                       ↓
                 [Codewort eingeben → Gefunden!]
```

### 1. Start-/Regel-Screen

- Wird beim App-Start angezeigt.
- Drei Abschnitte: **Geocaching-Regeln**, **Sicherheit**, **Umwelt** (Texte s. u.).
- Button „Verstanden – los geht's". Beim ersten Start Pflicht (Bestätigung wird gemerkt),
  später über ein Menü erneut aufrufbar.

### 2. Cache-Liste (Home)

- Karten-Einträge je Cache: Name, kurze Beschreibung, **Luftlinien-Entfernung** (groß),
  Status-Badge (✅ erledigt / ⬜ offen).
- Sortiert nach Entfernung (nächster zuerst).
- Umschalter oben: **Liste | Karte**.
- GPS-Status-Hinweis (aktiv / wird gesucht).

### 3. Karte

- OSMDroid-Karte: eigener Standort als blauer Punkt, Cache-Pins (offen/erledigt farblich
  unterscheidbar).
- Offline-Tiles im Schulbereich (~2×2 km), automatischer Online-OSM-Fallback außerhalb.
- Tippen auf einen Pin → Cache-Detail.

### 4. Cache-Detail

- Name, Beschreibung, **große Live-Entfernungsanzeige** und Richtungspfeil zum Ziel.
- Kleine Karte mit eigenem Standort + Ziel.
- Button **„Foto aufnehmen"** (Kamera-Intent) — Foto wird dem Cache lokal zugeordnet.
- Button **„Gefunden – Codewort eingeben"** → Eingabefeld. Bei korrektem Codewort wird der
  Cache als erledigt markiert (mit Bestätigung/Erfolg-Hinweis).
- Bereits aufgenommene Fotos des Caches werden hier angezeigt.

---

## Datenmodell & Datenfluss

### `caches.json` (im App-Bundle, von Lehrern editierbar)

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
  unabhängig von Groß-/Kleinschreibung und führenden/abschließenden Leerzeichen (Normalisierung
  vor dem Vergleich).

### Lokaler Fortschritt (DataStore, pro Gerät)

Pro Cache-`id`:
- `erledigt` (ja/nein)
- Zeitpunkt der Erledigung
- Liste der zugehörigen Foto-Dateipfade

### Fotos

- Aufnahme über Kamera-Intent, gespeichert im app-internen Speicher
  (`filesDir/photos/<cacheId>/`), Pfad im Fortschritt vermerkt.

### Datenfluss

1. App-Start → Regeln (falls noch nicht bestätigt) → Cache-Liste.
2. GPS via FusedLocationProvider als StateFlow; Entfernungen werden laufend neu berechnet
   (Luftlinie, Haversine-Formel).
3. Cache wählen → Detail zeigt Live-Entfernung + Richtungspfeil.
4. Foto aufnehmen → lokal gespeichert, dem Cache zugeordnet.
5. Codewort korrekt → Cache als erledigt markiert, Liste/Karte aktualisiert.

### Architektur (analog DrumRum)

```
rshgeocaching/
├── ui/
│   ├── rules/      # Start-/Regel-Screen
│   ├── list/       # Cache-Liste
│   ├── map/        # Karte (OSMDroid)
│   ├── detail/     # Cache-Detail + Foto + Codewort
│   └── theme/      # Color.kt, Type.kt, Theme.kt (Schulfarben)
├── viewmodel/
│   └── CacheViewModel   # Standort, Caches, Fortschritt, Entfernungen
├── data/
│   ├── location/   # FusedLocationProviderClient
│   ├── caches/     # caches.json-Loader (Moshi)
│   ├── progress/   # DataStore (erledigt, Fotos)
│   └── photos/     # Foto-Speicherung
└── model/
    ├── Cache           # id, name, beschreibung, lat, lon, codewort
    └── CacheProgress   # erledigt, zeitpunkt, fotoPfade
```

---

## Berechtigungen

| Berechtigung | Zweck |
|---|---|
| `ACCESS_FINE_LOCATION` | GPS-Standort für Entfernung und Karte |
| `CAMERA` | Foto am Fundort aufnehmen |
| `INTERNET` | Online-OSM-Tiles außerhalb des Offline-Bereichs |

Berechtigungen werden beim ersten Bedarf abgefragt (Standort beim Start, Kamera bei der
ersten Fotoaufnahme).

---

## Fehlerbehandlung

| Situation | Verhalten |
|---|---|
| Kein GPS-Signal | Hinweistext in Liste/Detail, Entfernung „wird ermittelt…" |
| GPS-Berechtigung verweigert | Erklärungstext + Button zu den App-Einstellungen |
| Kamera-Berechtigung verweigert | Hinweis, „Gefunden"-Eintrag bleibt ohne Foto möglich |
| Falsches Codewort | Freundlicher Hinweis „Codewort stimmt nicht – schau nochmal auf den Zettel" |
| Offline + außerhalb des Tile-Bereichs ohne Netz | Karte zeigt leere/graue Tiles, Liste und Entfernung funktionieren weiter |
| `caches.json` fehlerhaft | Fehlermeldung beim Start (für Lehrer/Entwickler), saubere statt Absturz |

---

## Testing

Reine Kotlin-Unit-Tests (JUnit):

1. **Codewort-Prüfung** — Normalisierung (Groß-/Kleinschreibung, Leerzeichen), korrekt/falsch.
2. **Entfernungsberechnung** — Haversine-Formel gegen bekannte Referenzwerte.
3. **caches.json-Parser** — gültige und ungültige Eingaben.

UI, GPS, Kamera und die Offline-/Online-Kartenumschaltung werden manuell auf dem Gerät
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

- **Zentrale Serverspeicherung** mit Fortschrittsübersicht aller Gruppen für Lehrer
  (ca. 2–3× Mehraufwand: Backend, Authentifizierung, Datenschutz für Minderjährige,
  Umgang mit schlechtem WLAN).
- **Lehrer-Alarm / SOS-Funktion** — Unterstützung anfordern bei Verlaufen oder Unfall.
- **Caches per URL nachladen** — `caches.json` ohne neues APK aktualisierbar.
- **iOS-Version** als separates Projekt.
