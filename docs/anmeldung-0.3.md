# BSVG CMS 0.3 – eigene Anmeldung

Stand: 1. November 2026. Entwicklungsstand, noch keine Freigabe für den regulären Schulbetrieb.

## Zwei Umgebungen

Auf der privaten Sites-Werkstatt gilt weiterhin die Plattformanmeldung. Die unabhängige Node.js-/Docker-Version besitzt jetzt eigene Konten. Eine gleiche E-Mail-Adresse verbindet diese Identitäten nicht automatisch. Eigene Passwörter werden ausschließlich auf dem unabhängigen Server verarbeitet.

## Lokal starten

Im Projektordner in Visual Studio Code ein PowerShell-Terminal öffnen:

```powershell
npm.cmd ci
npm.cmd run build:standalone
$env:CMS_DATA_DIR="data/eigene-anmeldung"
npm.cmd run preview:standalone
```

Auf diesem Entwicklungsrechner ist dieses Datenverzeichnis bereits mit den vorhandenen zwei vorbereiteten Konten und der Testklasse aus der privaten Werkstatt befüllt. Beide Konten sind noch ausstehend, es gibt keine gesetzten Passwörter. Diese persönlichen Daten sind weder im Quellcode noch im ZIP enthalten. Bei einem frischen Checkout stattdessen die Inhalte über **Export & Sicherung** übertragen oder Konten neu anlegen.

Dann im Browser `http://127.0.0.1:3100/werkstatt` öffnen. Dieser bewusst passwortlose Einrichtungszugang funktioniert nur im lokalen Entwicklungsmodus. Er darf nicht öffentlich bereitgestellt werden. Strg+C beendet die Anwendung.

## Eigenes Administratorkonto aktivieren

1. In der lokalen Werkstatt **Benutzer** öffnen.
2. Beim eigenen vorbereiteten Administratorkonto **Aktivierungslink** wählen.
3. Den angezeigten Link selbst in einem neuen Browser-Tab öffnen.
4. Selbst ein Passwort mit mindestens 15 Zeichen eingeben und bestätigen. Keine Passwörter in diesen Chat schreiben.
5. Danach unter `http://127.0.0.1:3100/anmelden` mit E-Mail-Adresse und Passwort anmelden. Das Passwort wird beim Aktivieren gesetzt, es erfolgt keine automatische Anmeldung.
6. Die Lehrkräfteansicht öffnet sich. Über **Verwaltung** sind für die Administration die freigegebenen Bearbeitungsfunktionen erreichbar.
7. Für das Schülerkonto denselben Ablauf wiederholen. Den Link nur der vorgesehenen Person nach Identitätsprüfung aushändigen.

Aktivierungslinks sind einmalig und 24 Stunden gültig. Ein neuer Link ersetzt den vorherigen. Es wird derzeit keine E-Mail verschickt und kein automatischer Nachweis des E-Mail-Besitzes behauptet. Der Link selbst ermöglicht die Einrichtung des Kontos und ist deshalb vertraulich zu behandeln.

Zum anschließenden Testen ohne lokalen Einrichtungszugang Anwendung beenden und im gleichen Terminal starten:

```powershell
npm.cmd run preview:accounts
```

Die vorhandenen Passwörter bleiben bestehen; nach einem Neustart erneut anmelden. `/werkstatt` ist in diesem Modus ohne einen gesondert konfigurierten Betreiberzugang gesperrt.

## Ansichten und Berechtigungen

| Adresse | Zweck |
| --- | --- |
| `/` | Öffentliche Basisansicht, nur veröffentlichte Website-Beiträge |
| `/anmelden` | Eigene Anmeldung; die tatsächlichen Rollen kommen aus der Datenbank |
| `/lehrkraefte` | Lehrkräfteinformationen und geschützte Downloads |
| `/schueler` | Freigegebene Schülerinformationen der eigenen laufenden Klassen |
| `/verwaltung` | Bearbeitung gemäß Rollen und Berechtigungen |
| `/konto/passwort` | Eigenes Passwort mit bisherigem Passwort ändern |
| `/betrieb` | Gesonderter Betreiberzugang auf dem HTTPS-Testserver |

Die Auswahl „Lehrkräfte“ oder „Schüler“ auf der Homepage erteilt keine Berechtigung. Schüler können weder die Lehrkräfteansicht noch die Verwaltung öffnen oder Benutzer anlegen. Klassenzeiträume und Mitgliedschaften werden bei der Inhaltsausgabe geprüft. Vor Lehrgangsbeginn erscheinen noch keine Informationen für eine erst später laufende Klasse.

## Passwort vergessen oder Konto sperren

Die Administration prüft zunächst die Identität der Person und erstellt in **Benutzer** einen Rücksetzlink für das bereits aktive Konto. Dieser gilt 30 Minuten und nur einmal. Es gibt noch keinen automatischen Mailversand. Nach Passwortänderung oder Zurücksetzen werden vorhandene Sitzungen widerrufen. Das Sperren eines Kontos verhindert weitere Anmeldungen und Zugriffe. Eine Änderung der E-Mail-Adresse erfordert eine neue Aktivierung.

Passwörter werden mit Node/OpenSSL scrypt, individuellem Zufallswert und begrenzter paralleler Berechnung gespeichert. Der Server begrenzt Anmeldeversuche. Sitzungen enden nach 30 Minuten Inaktivität oder spätestens acht Stunden sowie nach Serverneustart. Beim HTTPS-Betrieb werden sichere HttpOnly-Cookies verwendet. Lokales HTTP ist ausschließlich an Loopback erlaubt.

## Umziehen und sichern

**Quellcode-ZIP:** Programm ohne Laufzeitdaten und Geheimnisse.

**JSON-Export:** Beiträge, Dateien, Konten, Klassen und Mitgliedschaften. Enthält keine Passwort-Hashes, Sitzungen oder Einmallinks. Beim Import von Format 2 werden Konten wieder auf ausstehende Aktivierung gesetzt. Für einen Transfer von Sites zum eigenen Server ist dies der vorgesehene erste Weg.

**Vollständiger Serverumzug mit bestehenden Passwörtern:** Anwendung sauber anhalten, anschließend das gesamte konfigurierte Datenverzeichnis mit SQLite-Datenbank und Dateiverzeichnis sichern und auf die neue Installation übertragen. Vorhandene SQLite-Nebendateien ebenfalls mitnehmen; keine laufende Datenbank mit gewöhnlichem Dateikopieren sichern. Den neuen Server mit diesem Verzeichnis starten und Anmeldung sowie Downloads prüfen. Danach neu anmelden. Der automatische Test prüft die Übertragung einer gestoppten Installation mit unverändertem Passwort. Eine Datenkopie enthält vertrauliche Passwort-Hashes und möglicherweise gültige Einmallinks: verschlüsselt aufbewahren und Zugriff begrenzen.

Für Docker liegt dieser Bestand im Volume `cms-data`, nicht im Container-Image. `docker compose down -v` würde das Volume löschen. Bei der Übersiedlung auch HTTPS, `CMS_ORIGIN`, Betreibergeheimnis und Dateiberechtigungen auf dem Zielserver konfigurieren. Den alten Server bis zur abgeschlossenen Prüfung nur angehalten bereithalten; keine zwei unabhängig beschreibbaren Kopien betreiben.

## Prüfung und verbleibender Ausbau

Automatisierte Prüfungen decken Einmallinks, Ablauf, Wiederverwendung, Passwortänderung, Sitzungswiderruf, Umzug, Rollenmanipulation, serverseitige Bereichssperren, fremde Anfrageherkunft und die Trennung öffentlicher/interner Inhalte ab. Browserprüfungen verwenden ausschließlich künstliche Testkonten. Die beiliegenden Screenshots zeigen diese Testkonten.

Die vollständige öffentliche Schulwebsite, Seiteneditor und Freigabeprozess, Intranetstruktur, Klassenkommunikation, Mailversand, Mehrfaktor-Anmeldung und betriebliche Absicherung folgen gesondert. Die Anmeldung allein bedeutet noch keine Produktivfreigabe.

Technische Grundlage: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [Node.js scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback).
