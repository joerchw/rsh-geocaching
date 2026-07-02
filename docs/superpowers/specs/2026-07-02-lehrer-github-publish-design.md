# Lehrer-Veröffentlichen nach GitHub — Design Spec

## Ziel

Der Lehrerbereich schreibt Caches und Regeltexte direkt über die GitHub-API in den
`main`-Branch des Repos, statt dass der Lehrer den JSON-Export manuell kopieren und auf
GitHub einfügen muss. Ein neuer Button „Veröffentlichen" ersetzt den bisherigen
„JSON exportieren"-Button in beiden Tabs (Caches, Regeln). Die bestehende
`localStorage`-Override-Logik (`rsh_caches_admin`, `rsh_rules_admin`) bleibt unverändert
die „lokale Wahrheit" für die Lehrer-UI — Veröffentlichen ist ein zusätzlicher,
bewusst ausgelöster Schritt, kein automatischer Sync.

---

## Architektur

Neues Modul `js/github-publish.js`, geladen nur von `js/admin.js` (nicht Teil der
Schüler-PWA, nicht im Service-Worker-App-Shell — `lehrer.html` registriert ohnehin
keinen Service Worker). Kapselt:

- Token-Verwaltung (`localStorage`-Schlüssel `rsh_github_token`)
- Token-Eingabe-Modal mit Kurzanleitung
- Den eigentlichen Veröffentlichen-Vorgang (GitHub Contents API: `GET` für die aktuelle
  `sha`, dann `PUT` mit dem neuen Inhalt)

Repo und Branch sind fest einprogrammiert (`joerchw/rsh-geocaching`, `main`) — passend
zum bestehenden Muster (`ADMIN_PASSWORD` ist in `admin.js` genauso hartkodiert).

`js/admin.js` ruft `publishFile(path, content, commitMessage)` auf und behandelt
Erfolg/Fehler direkt am Button (Text/Deaktivierung), analog zum bestehenden
`alert()`-basierten Fehlermuster (z. B. GPS-Fehler in `renderCacheForm`).

---

## Token-Setup

Klick auf „Veröffentlichen" ohne gespeicherten Token öffnet ein Modal (gleicher
Overlay-Stil wie `showScanModal`/`showShareModal`) mit einer kurzen, nummerierten
Anleitung:

1. Auf github.com anmelden → Settings → Developer settings → Fine-grained tokens →
   Generate new token
2. Repository access: nur **joerchw/rsh-geocaching** auswählen
3. Permissions → Contents: **Read and write**
4. Token erzeugen und hier einfügen

Darunter ein Passwort-Eingabefeld, der Hinweis „Nur auf deinem eigenen Gerät eingeben,
nicht auf einem gemeinsam genutzten Computer.", sowie „Speichern"/„Abbrechen".
Gespeicherter Token wird bei künftigen Aufrufen nicht erneut abgefragt.

Ein kleiner „Token ändern"-Link neben dem Veröffentlichen-Button in **beiden** Tabs
löscht den gespeicherten Token und öffnet das Modal erneut — für den Fall, dass der
Token abläuft oder ersetzt werden muss.

**Automatisches Zurücksetzen:** Antwortet GitHub auf `GET` oder `PUT` mit `401`/`403`
(ungültiger/abgelaufener Token oder fehlendes Schreibrecht), wird der gespeicherte
Token sofort gelöscht und eine klare Fehlermeldung angezeigt; der nächste
Veröffentlichen-Versuch fragt automatisch neu.

---

## Veröffentlichen-Ablauf

```
GET  https://api.github.com/repos/joerchw/rsh-geocaching/contents/{path}?ref=main
     → liefert aktuelle `sha`
PUT  https://api.github.com/repos/joerchw/rsh-geocaching/contents/{path}
     Body: { message, content: <base64(UTF-8(json))>, sha, branch: "main" }
```

`{path}` ist `data/caches.json` bzw. `data/rules.json`. Der veröffentlichte Inhalt ist
derselbe JSON-String, der bisher in den Export ging (`JSON.stringify(adminCaches, null, 2)`
bzw. `adminRules`). Commit-Message fest: `chore: update caches.json via Lehrerbereich`
bzw. `chore: update rules.json via Lehrerbereich` (Englisch, passend zur bisherigen
Commit-Historie des Repos).

**UTF-8-sicheres Base64:** `btoa()` allein verschluckt sich an Umlauten (dieselbe
Fehlerklasse, die schon einmal beim QR-Code-Encoding aufgetreten ist — siehe
`docs/superpowers/specs/2026-07-01-qr-cache-sharing-design.md`). Kodierung läuft über
`TextEncoder` → Byte-für-Byte-String → `btoa()`:

```js
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
```

Diese Funktion wird exportiert und **unit-getestet** (Node hat `btoa`/`atob`/
`TextEncoder`/`TextDecoder` global) — Roundtrip-Test mit ASCII und mit deutschen
Umlauten, um genau diese Fehlerklasse von vornherein abzudecken. Ebenso getestet:
`loadGithubToken`/`saveGithubToken`/`clearGithubToken` (reine `localStorage`-Wrapper,
analog zu den bestehenden Tests für `js/username.js`).

**Erfolg:** Button zeigt kurz „Veröffentlicht!" (analog zum „Kopiert!"-Muster im
bestehenden Export-Modal), dann zurück zu „Veröffentlichen".

**UI-Zustand während des Vorgangs:** Button wird deaktiviert und zeigt „Veröffentliche…",
bis die Anfrage abgeschlossen ist (verhindert Doppelklicks während der Netzwerklaufzeit).

---

## Fehlerbehandlung

| Fall | Verhalten |
|------|-----------|
| Kein Token gespeichert | Token-Modal öffnet sich, Vorgang läuft nach Eingabe automatisch weiter |
| Token ungültig/abgelaufen (401/403) | Token wird gelöscht, Fehlermeldung „Token ungültig oder ohne Schreibrecht. Bitte neuen Token eingeben und erneut versuchen." |
| `sha`-Konflikt beim Schreiben (409, Datei wurde inzwischen anderswo geändert) | Fehlermeldung „Die Datei wurde inzwischen anderswo geändert. Bitte Seite neu laden und erneut versuchen." |
| Kein Netzwerk / sonstiger Fehler | Fehlermeldung mit Klartext aus der API-Antwort, falls vorhanden, sonst HTTP-Status |
| Modal „Abbrechen" | Vorgang bricht ab, kein Fehler-Alert, lokaler Stand bleibt unverändert |

In allen Fehlerfällen bleibt der lokale `localStorage`-Override unangetastet — ein
fehlgeschlagener Veröffentlichen-Versuch verliert nie lokale Änderungen.

---

## Verlauf / Wiederherstellung

Da „Veröffentlichen" echte Commits auf GitHub erzeugt, ist die komplette
Versionshistorie beider Dateien automatisch vorhanden — jede vorherige Version bleibt
erhalten und lässt sich über GitHub wiederherstellen, auch nach einem versehentlichen
Löschen. Damit das für eine Lehrkraft ohne Git-Kenntnisse nutzbar ist, bekommt jeder
Tab (Caches, Regeln) einen Link „Verlauf ansehen" neben dem Veröffentlichen-Button, der
die GitHub-Commit-Historie der jeweiligen Datei in einem neuen Tab öffnet:

- Caches: `https://github.com/joerchw/rsh-geocaching/commits/main/data/caches.json`
- Regeln: `https://github.com/joerchw/rsh-geocaching/commits/main/data/rules.json`

Kein eigener Code für Backup/Wiederherstellung nötig — der Link macht nur die ohnehin
vorhandene Git-Historie sichtbar und nutzbar. Von dort kann die Lehrkraft eine ältere
Version ansehen und ihren Inhalt zurückkopieren (GitHub zeigt bei jeder Commit-Version
einen „Raw"/Rohdaten-Link zum Kopieren).

Lokale, noch nicht veröffentlichte Änderungen deckt das nicht ab — dafür bleibt
weiterhin „Serverversion wiederherstellen" zuständig (verwirft alle lokalen Änderungen
auf einmal, kein selektives Undo einzelner Schritte).

---

## Sicherheit

Der Token liegt nur in `localStorage` des Lehrer-Geräts, vergleichbar einem
gespeicherten Passwort. Wichtig: `localStorage` ist pro **Domain**, nicht pro Seite
geteilt — auf einem Gerät, das auch für die Schüler-Ansicht (`index.html`) genutzt
wird, wäre der Token technisch über die Entwicklertools auslesbar. Das ist kein neues
Risiko (der bestehende `rsh_caches_admin`-Override hat dieselbe Eigenschaft), wird aber
im Token-Modal explizit als Hinweis kommuniziert. Die empfohlene Fine-grained-Token-
Konfiguration (nur dieses Repo, nur Contents-Schreibrecht, mit Ablaufdatum) begrenzt den
Schaden bei Kompromittierung auf das absolute Minimum.

---

## Was unverändert bleibt

- `localStorage`-Override-Mechanismus (`rsh_caches_admin`, `rsh_rules_admin`) und
  „Serverversion wiederherstellen" funktionieren exakt wie bisher
- QR-Scannen/Teilen-Funktionen im Lehrerbereich (unverändert)
- Schüler-App (`index.html`) — komplett unberührt, kein Bezug zu GitHub-Zugangsdaten
- `showExportModal` wird entfernt, da beide bisherigen Aufrufer (Caches- und
  Regeln-Tab) durch „Veröffentlichen" ersetzt werden und keine weiteren Aufrufer
  existieren

---

## Dateien

| Datei | Änderung |
|-------|----------|
| `js/github-publish.js` | Neu: Token-Verwaltung, Token-Modal, `publishFile()`, `utf8ToBase64()` |
| `tests/github-publish.test.js` | Neu: Tests für `utf8ToBase64()` (ASCII + Umlaute) und die Token-`localStorage`-Wrapper |
| `js/admin.js` | „JSON exportieren" → „Veröffentlichen" in beiden Tabs; `showExportModal` entfernt; „Token ändern"- und „Verlauf ansehen"-Links |
