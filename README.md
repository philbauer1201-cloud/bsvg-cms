# BSVG CMS · Werkstatt 0.1

Eine Schule, zwei Standorte: Vöcklabruck und Gmunden. Privates, ausführbares CMS-Grundgerüst im BSVG-Design. Noch kein freigegebenes Produktivsystem.

## Was funktioniert

- Beiträge anlegen, bearbeiten und löschen; Standort, Zielbereich und Freigabestatus festlegen.
- Nach Titel/Kurztext, Standort und Status filtern.
- Interne Vorschau freigegebener Website-Beiträge. Keine automatische öffentliche Schulwebsite.
- PNG, JPG, WebP, PDF und UTF-8-TXT hochladen, geschützt herunterladen und aus der Mediathek entfernen.
- Vollständiger JSON-Export und geprüfte Wiederherstellung von Beiträgen und Dateien.
- Dieselbe Oberfläche und derselbe Anwendungskern auf Sites und als unabhängige Node.js-Anwendung.

## Schnellstart außerhalb von Sites

Voraussetzung: eine unterstützte Node.js-24-LTS-Version oder neuer. Python ist nicht erforderlich.

```powershell
npm.cmd ci
npm.cmd run build:standalone
npm.cmd run preview:standalone
```

Danach `http://127.0.0.1:3100` öffnen. Der Preview-Modus ist ausdrücklich ohne eigene Benutzeranmeldung und bindet ausschließlich an Loopback. Nur mit Testdaten verwenden. Mit Strg+C beenden. Er benötigt weder ein Sites-Konto noch Cloudflare, eine Sites-Laufzeit oder Microsoft.

Die lokale Datenbank liegt unter `data/cms.sqlite`, Dateien unter `data/files`. Der Inhalt bleibt nach einem Neustart erhalten. Diese Verzeichnisse werden nicht in Git aufgenommen. Bei Live-Backups SQLite-WAL berücksichtigen; bevorzugt den konsistenten Anwendungsexport nutzen.

## Sites lokal

```powershell
npm.cmd run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_aberrant_caretaker.sql
npm.cmd run dev
```

Die erste Migration nur einmal auf eine neue lokale Datenbank anwenden. Spätere Migrationen in Reihenfolge nachführen. Im Browser `http://127.0.0.1:5173/signin-with-chatgpt?return_to=/` für den ausschließlich lokalen Mock-Zugang öffnen. Hosted Sites verwenden die echte Plattformanmeldung. Die aktuelle Veröffentlichung bleibt owner-private; vor jeder Erweiterung des Publikums müssen eigene CMS-Mitgliedschaften und serverseitige Rollen ergänzt werden.

Hosted-Veröffentlichung ausschließlich über den Sites-Workflow. Die Projektidentität steht in `.openai/hosting.json`. GitHub und Sites besitzen getrennte Quellcode-Ziele; die vorhandene GitHub-Verbindung darf nicht ersetzt werden.

## Datentransfer

1. Unter **Export & Sicherung** eine Sicherung herunterladen.
2. Eine leere zweite Installation starten.
3. Dort **Sicherung auswählen** verwenden und das Ersetzen bestätigen.
4. Beiträge, Standorte und Dateien prüfen; erneut exportieren und vergleichen.

Format: `bsvg-cms`, Version `1`. Dateien liegen als Base64 samt SHA-256-Prüfsumme im JSON. Ungültige Versionen, doppelte Kennungen und beschädigte Dateien werden abgewiesen, bevor der aktuelle Datenstand ersetzt wird. Konkurrierende Schreibzugriffe werden über Revisionen erkannt. Nach Wiederherstellung beginnt der Aktivitätsverlauf mit dem Wiederherstellungsereignis neu; der alte Verlauf ist im Export enthalten, wird aber nicht als vertrauenswürdiges Auditlog eingelesen.

Die Sicherung ist unverschlüsselt und kann interne Inhalte enthalten. Geschützt aufbewahren und transportieren. Sie enthält keine Zugangsschlüssel oder laufenden Sitzungen. Source-ZIP, Datensicherung und Geheimnisse sind getrennte Pakete.

Grenzen des Grundgerüsts: 500 Beiträge, höchstens 1,5 MB Text/Metadaten, 40 Dateien, 2 MB je Datei und 10 MB Dateiinhalte insgesamt. Verwaiste Dateiobjekte bleiben für laufende Exporte erhalten; physische Bereinigung und eine dauerhafte Aufbewahrungsrichtlinie folgen später.

## Docker und eigener HTTPS-Testserver

```powershell
Copy-Item .env.example .env
```

In `.env` einen zufälligen Administrationsschlüssel mit mindestens 32 Zeichen sowie `CMS_ORIGIN` auf die externe HTTPS-Adresse setzen. Zum Erzeugen eines Schlüssels beispielsweise `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` im eigenen Terminal verwenden und den Wert sicher verwahren. Anschließend:

```powershell
docker compose up --build -d
```

Der Container ist nur auf `127.0.0.1:3100` des Docker-Hosts veröffentlicht. Ein separat konfigurierter HTTPS-Reverse-Proxy muss die externe Adresse dorthin weiterleiten. Keine direkte ungeschützte Portfreigabe. `/login` verwendet den temporären Administrationsschlüssel und eine sichere, zeitlich begrenzte Sitzung. Diese Übergangslösung ersetzt keine fertige Lehrkräfte-Benutzerverwaltung. Daten werden im Volume `cms-data` gespeichert. Nicht unbedacht `docker compose down -v` verwenden: damit würden Volumedaten gelöscht.

## Noch nicht umgesetzt

Eigene Lehrkräftekonten, Einladungsversand, Passwortwiederherstellung, Mehrfaktor-Anmeldung, Rollenfreigaben, öffentliche Schulwebsite, fertig ausgegebenes Intranet, vollständiger produktiver Serverbetrieb und automatische Backup-Aufbewahrung.

Das bereitgestellte Original-SVG liegt unverändert unter `public/bsvg-logo.svg`. Es enthält falsch kodierte Textglyphen. Die Oberfläche zeigt deshalb vorläufig den Schulnamen als Text. Für das endgültige Logo wird ein korrigierter SVG-Export mit Schrift als Pfaden benötigt. Die CI-Schrift Poppins liegt mit OFL-Lizenz lokal bei.

## Prüfungen

```powershell
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run build:standalone
```

Der Testlauf prüft echte SQLite-Installationen, Neustart/Persistenz, vollständigen Export/Import inklusive Datei, Prüfsummenfehler, ungültige Beiträge, Konflikterkennung und Zugriffsschutz des separaten Node-Testservers. Sites-Build, lokale D1/R2-Übertragung und Browserprüfung werden zusätzlich geprüft; siehe `docs/pruefbericht-0.1.md`.
