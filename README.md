# BSVG CMS · Werkstatt 0.3

Eine Schule, zwei Standorte: Vöcklabruck und Gmunden. Privates, ausführbares CMS-Grundgerüst im BSVG-Design. Noch kein freigegebenes Produktivsystem.

## Was funktioniert

- Eigene Passwortanmeldung, Aktivierung, Abmeldung und Wiederherstellung über freigegebene Einmallinks in der unabhängigen Serverversion.
- Getrennte Lehrkräfte- und Schüleransichten mit serverseitiger Rechteprüfung.
- Benutzerkonten mit Rollen vorbereiten, Lehrgangsklassen verwalten und Mitgliedschaften zuordnen.
- Berechtigungen serverseitig prüfen und hypothetische Zugriffe ohne Rechteänderung nachvollziehen.
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

Danach `http://127.0.0.1:3100` öffnen: Die Startseite zeigt ausschließlich veröffentlichte Website-Beiträge. `/anmelden` führt zur eigenen Passwortanmeldung. Der lokale Einrichtungszugang `/werkstatt` ermöglicht die erste Kontoeinrichtung ohne Passwort und bindet ausschließlich an Loopback. Nur auf dem Entwicklungsrechner verwenden und mit Strg+C beenden. Für lokale Anmeldetests ohne diesen Betreiberzugang stattdessen `npm.cmd run preview:accounts` verwenden. Die unabhängige Anwendung benötigt weder Sites noch Microsoft. Die Anleitung `docs/anmeldung-0.3.md` erklärt Aktivierung und Wiederherstellung.

Die lokale Datenbank liegt standardmäßig unter `data/cms.sqlite`, Dateien unter `data/files`. Der Inhalt bleibt nach einem Neustart erhalten. Diese Verzeichnisse werden nicht in Git aufgenommen. Der JSON-Export sichert keine Passwörter. Für einen Umzug mit bestehenden Passwörtern die Anwendung anhalten und das vollständige Datenverzeichnis geschützt übertragen, siehe `docs/anmeldung-0.3.md`.

## Sites lokal

```powershell
npm.cmd run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_aberrant_caretaker.sql
npm.cmd run dev
```

Die erste Migration nur einmal auf eine neue lokale Datenbank anwenden. Spätere Migrationen in Reihenfolge nachführen. Im Browser `http://127.0.0.1:5173/signin-with-chatgpt?return_to=/` für den ausschließlich lokalen Mock-Zugang öffnen. Hosted Sites verwenden die echte Plattformanmeldung. Die aktuelle Veröffentlichung bleibt owner-private; die eigene Node.js-Passwortanmeldung wird dort nicht betrieben.

Hosted-Veröffentlichung ausschließlich über den Sites-Workflow. Die Projektidentität steht in `.openai/hosting.json`. GitHub und Sites besitzen getrennte Quellcode-Ziele; die vorhandene GitHub-Verbindung darf nicht ersetzt werden.

## Datentransfer

1. Unter **Export & Sicherung** eine Sicherung herunterladen.
2. Eine leere zweite Installation starten.
3. Dort **Sicherung auswählen** verwenden und das Ersetzen bestätigen.
4. Beiträge, Standorte und Dateien prüfen; erneut exportieren und vergleichen.

Format: `bsvg-cms`, Version `2` (Inhaltsimporte aus Version `1` bleiben möglich). Format 2 enthält zusätzlich Benutzer, Klassen und Mitgliedschaften; zuvor aktive Konten werden bei Wiederherstellung auf ausstehende Aktivierung gesetzt. Format 1 lässt ein bestehendes Benutzerverzeichnis unberührt. Dateien liegen als Base64 samt SHA-256-Prüfsumme im JSON. Ungültige Versionen, doppelte Kennungen und beschädigte Dateien werden abgewiesen, bevor der aktuelle Datenstand ersetzt wird. Konkurrierende Schreibzugriffe werden über Revisionen erkannt. Nach Wiederherstellung beginnt der Aktivitätsverlauf mit dem Wiederherstellungsereignis neu; der alte Verlauf ist im Export enthalten, wird aber nicht als vertrauenswürdiges Auditlog eingelesen.

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

Der Container ist nur auf `127.0.0.1:3100` des Docker-Hosts veröffentlicht. Ein separat konfigurierter HTTPS-Reverse-Proxy muss die externe Adresse dorthin weiterleiten. Keine direkte ungeschützte Portfreigabe. `/betrieb` verwendet den separaten Administrationsschlüssel zur Einrichtung unter `/werkstatt`. Lehrkräfte und Schüler verwenden `/anmelden` mit ihren eigenen Konten. Nach Aktivierung des Administratorkontos ist die tägliche Verwaltung unter `/verwaltung` möglich. Den Betreiberzugang als Notfallzugang geschützt verwahren. Daten werden im Volume `cms-data` gespeichert. Nicht unbedacht `docker compose down -v` verwenden: damit würden Volumedaten gelöscht.

## Noch nicht umgesetzt

Automatischer E-Mail-Versand und Nachweis des E-Mail-Besitzes, Mehrfaktor-Anmeldung, vollständige öffentliche Schulwebsite, vollständige Intranetstruktur, Klassenkommunikation, Seiteneditor und Freigabeprozess, produktiver Serverbetrieb und automatische Backup-Aufbewahrung. Aktivierungs- und Rücksetzlinks werden derzeit nach Identitätsprüfung persönlich durch die Administration ausgegeben. Es gibt keine offene Selbstregistrierung.

Das neue Schullogo liegt unverändert unter `public/bsvg-logo.svg`, das zugehörige Icon unter `public/favicon.svg`. Beide SVG-Dateien verwenden Pfade ohne externe Schriften und werden auf Sites und in der unabhängigen Serverversion eingebunden. Die CI-Schrift Poppins liegt mit OFL-Lizenz lokal bei.

## Prüfungen

```powershell
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run build:standalone
```

Der Testlauf prüft echte SQLite-Installationen, Neustart/Persistenz, vollständigen Export/Import inklusive Datei, Prüfsummenfehler, ungültige Beiträge, Konflikterkennung und Zugriffsschutz des separaten Node-Testservers. Sites-Build, lokale D1/R2-Übertragung und Browserprüfung werden zusätzlich geprüft; siehe `docs/pruefbericht-0.1.md` für die ursprüngliche Grundlage und `docs/benutzer-klassen-0.2.md` für den aktuellen Ausbau.

## Konten und Lehrgangsklassen

Unter **Benutzer** Konten vorbereiten und Rollen zuordnen. Unter **Klassen & Lehrgänge** Standort und Zeitraum anlegen und die Konten zuordnen. Eine Mitgliedschaft aktiviert kein Konto. Mit **Berechtigungen nachvollziehen** kann die Wirkung nach einer hypothetischen Aktivierung an einem gewählten Datum geprüft werden, ohne Daten zu ändern.

Konkrete Personen- und Klassendaten liegen ausschließlich im privaten Laufzeitspeicher und gehören nicht in das Quellcode-ZIP. Die eigene Anmeldung ist in der unabhängigen Serverversion umgesetzt; der automatische Mailversand folgt später. Die private Sites-Werkstatt verwendet weiterhin den getrennten Plattformzugang. Gleiche E-Mail-Adressen verbinden diese Identitäten nicht automatisch.
