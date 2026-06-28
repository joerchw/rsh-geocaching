# RSH Geocaching

Geocaching-Web-App (PWA) für die Projektwoche der Realschule am Hemberg.
Läuft im Browser auf iOS und Android. Kein App-Store, keine Installation nötig.

## Lokal testen

Voraussetzung: Node.js 18+ (nur für die Tests) und ein einfacher Webserver.

```bash
# Unit-Tests (reine Logik)
npm test

# App lokal starten (localhost gilt als sicherer Kontext)
python -m http.server 8000
# dann http://localhost:8000 öffnen
```

GPS, Kamera und Service Worker brauchen einen **sicheren Kontext** (HTTPS oder localhost).

## Caches pflegen (für Lehrer)

Die Caches stehen in `data/caches.json`. Pro Cache:

| Feld | Bedeutung |
|---|---|
| `id` | eindeutige Kennung (z. B. `cache-01`) |
| `name` | Anzeigename |
| `beschreibung` | kurzer Hinweis |
| `latitude` / `longitude` | Koordinaten (Dezimalgrad) |
| `codewort` | Wort vom Zettel in der Dose |

Koordinaten findet man z. B. per Rechtsklick in Google Maps oder auf openstreetmap.org.

## Veröffentlichen (Hosting)

Es ist eine statische Seite — alle Dateien auf einen HTTPS-Webspace kopieren. Empfehlung
für die Testphase: **Cloudflare Pages** (kostenlos, HTTPS). Final optional auf dem
Schul-Server `rsamhemberg.de`.

Nach dem Hochladen die URL als **QR-Code** erzeugen (z. B. mit einem Online-QR-Generator)
und an die Klasse verteilen. Schüler öffnen den Code und können die Seite optional
„zum Startbildschirm hinzufügen".

## Anpassung vor der Projektwoche

- `data/caches.json`: echte Caches eintragen.
- `js/map.js`: `DEFAULT_CENTER` / `DEFAULT_ZOOM` auf die Schule setzen.
- `css/style.css`: Schulfarben (CSS-Variablen unter `:root`) bei Bedarf feinjustieren.
- Regeltexte in `js/rules.js` nach der Testphase final festlegen.
