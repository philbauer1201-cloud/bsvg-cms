# Prüfbericht BSVG CMS 0.1

Stand: 30.10.2026. Grundgerüst, keine Produktivfreigabe.

## Erfolgreich geprüft

- TypeScript: `tsc --noEmit` ohne Fehler.
- Automatisierte Tests: drei Tests bestanden. Echte SQLite-Quelle und separates leeres SQLite-Ziel, Dateiübertragung, wiederholter Export und Persistenz nach Datenbank-Neustart.
- Abgewiesene beschädigte Backups verändern die vorhandenen Daten nicht. Unbekannte Formatversionen und veraltete Schreibrevisionen werden abgewiesen.
- Nicht angemeldete API-Anfragen, fremde Origins, ungültige Standorte, SVG-Uploads, falsch deklarierte PNGs und übergroße Dateien werden abgewiesen.
- Node-Testserver: Anmeldeprüfung, sichere Sitzungscookies, CSRF-Abweisung und Anmeldebegrenzung getestet.
- Eigenständige React-Ausgabe mit Vite erfolgreich gebaut und auf einem Node.js-HTTP-Server gestartet.
- Docker-Image unter Linux erfolgreich gebaut. Isolierter Testcontainer läuft als nicht privilegierter Benutzer, beantwortet den Healthcheck mit HTTP 200 und verweigert unangemeldete API-Aufrufe mit HTTP 401. Ein produktiver HTTPS-Reverse-Proxy wurde damit nicht getestet.
- Sites-Vinext-Ausgabe erfolgreich gebaut. Datenbankmigration lokal angewandt.
- Ein Export aus SQLite/Dateiverzeichnis mit vier Testbeiträgen und zwei Testdateien wurde in die lokale Sites-Variante importiert und aus D1/R2 wieder exportiert. Beiträge und Dateiinhalte inklusive Prüfsummen waren gleich. Nicht angemeldete Sites-API-Anfrage lieferte HTTP 401.
- Browser: Beispielbeiträge laden, Beitragseditor öffnen, neuen Testbeitrag erstellen und Speicherung bestätigen. Desktopansicht mit vier Kennzahlen und beiden Standortkarten geprüft. Mobile Navigation und Sicherungsansicht geprüft; keine horizontale Überbreite in der geprüften Mobilansicht.

## Grenzen des Nachweises

Es wurden ausschließlich Testdaten verwendet. Der temporäre Node-Administrationszugang ist keine fertige Benutzerverwaltung. Kein Nachweis eines produktiven HTTPS-Reverse-Proxys, produktiven E-Mail-Versands oder realen Schulserverbetriebs. Private Sites-Veröffentlichung wird separat durch deren Deployment-Ergebnis bestätigt. Eine physische Bereinigung unreferenzierter Dateiobjekte und automatische Backup-Aufbewahrung fehlen noch.

Die Original-SVG-Datei enthält falsch kodierte Textglyphen. Die Oberfläche verwendet vorläufig lesbaren Schulnamen als Text und bewahrt das Original unverändert auf.
