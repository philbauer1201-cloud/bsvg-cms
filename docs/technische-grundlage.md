# BSVG-CMS – technische Grundlage

Stand: 29.10.2026. Planungsstand; noch keine implementierte oder getestete Anwendung.

## Festgelegtes Ziel

Ein CMS für eine Schule mit den Standorten Vöcklabruck und Gmunden. Öffentliche Schulwebsite, geschütztes Lehrkräfte-Intranet und Inhaltsverwaltung. Entwicklung und Vorschau mit Sites; produktiver Betrieb auf einem eigenen Webserver. Microsoft wird nicht als Anmeldedienst eingeplant. Benutzer, Rechte, Inhalte und Dateien müssen kontrolliert exportierbar und wiederherstellbar sein.

## Portabilität als Abnahmekriterium

Schon die erste ausführbare Version muss zusätzlich außerhalb von Sites starten. Jede freigegebene Version erhält ein Quellcodepaket, dokumentierte Laufzeitvoraussetzungen und einen getesteten Wiederherstellungsweg. Ein ZIP allein genügt nicht. Bei aktiven Schreibzugriffen benötigen Datenbank und Dateien einen gemeinsamen konsistenten Sicherungsstand; der endgültige Umzug kann eine kurze Schreibpause erfordern. Ein jederzeit vorbereitbarer Umzug bedeutet keine zugesagte unterbrechungsfreie Migration.

## Technischer Vorschlag

- React und TypeScript für die Oberfläche, Tailwind für BSVG-Komponenten.
- Plattformunabhängige TypeScript-Module für Inhalte, Benutzer, Rollen, Standortzuordnung und Freigaben.
- Getrennte Anbindungen für HTTP-Laufzeit, Identität, Datenbank, Dateispeicher und E-Mail-Versand.
- Sites-Anbindung für die dort unterstützte Worker-Laufzeit, D1 und R2; eigener Server mit dokumentierter Node.js-Laufzeit und containerisierter Bereitstellung.
- Datenbank-Zielformat vor dem ersten dauerhaften Datenmodell durch einen kleinen Export-/Importversuch festlegen. SQLite ist für eine einzelne Schule ein zu prüfender Kandidat; PostgreSQL bleibt eine Alternative. D1 ist kein austauschbarer PostgreSQL-Server.
- Dateispeicher über eine gemeinsame Schnittstelle: Sites R2 während der Entwicklung, persistenter Serverordner oder S3-kompatibler Speicher auf dem Zielserver. Dateien über stabile IDs referenzieren, nicht über fest eingebaute Sites-URLs.
- Keine Sites-Geheimnisse, absoluten Serveradressen oder plattformspezifischen Benutzerkennungen im fachlichen Datenmodell.

Diese Auswahl ist ein Architekturvorschlag, noch kein Nachweis der Lauffähigkeit. Der erste technische Schritt prüft beide Laufzeiten, Speicherung und Wiederherstellung gemeinsam.

## Eigene Benutzerkonten

Eigene unveränderliche Benutzer-ID, Name, bestätigte E-Mail-Adresse, Status und Standortzuordnung. Rollen: Lehrkraft, Redaktion, Administration. Standortbezug und Veröffentlichungsziel sind getrennte Felder. Alle Rechte werden auf dem Server geprüft.

Keine offene Selbstregistrierung als Ausgangspunkt: Administration legt ein Konto an; eine zeitlich begrenzte Einladung ermöglicht die Bestätigung und das Setzen eines eigenen Passworts. Eine E-Mail-Adresse allein ist kein Identitätsnachweis. Der Versanddienst wird separat konfiguriert; ohne eingerichteten Versand ist dieser Ablauf nicht betriebsbereit.

Auf dem eigenen Server: gepflegte Authentifizierungsbibliothek statt eigener Kryptografie, Argon2id-Passworthashes mit getesteten Parametern, sichere Sitzungscookies, Schutz gegen CSRF und automatisierte Anmeldeversuche, widerrufbare Sitzungen und einmalig nutzbare Wiederherstellungstokens. Mehrfaktor-Anmeldung und Wiederherstellung für Administration vor Produktivstart prüfen und umsetzen. Sicherheitsrelevante Konto- und Rollenänderungen protokollieren, ohne Kennwörter oder Tokens zu protokollieren.

## Grenze während der Entwicklung auf Sites

Die verfügbare Sites-Integration verwendet die Plattformanmeldung über ChatGPT. Sie wird in der Sites-Version beibehalten. Eine eigene Kennwortanmeldung ersetzt diese Plattformanmeldung dort nicht. Die Plattformidentität wird über eine gesonderte Zuordnung auf eine interne CMS-Benutzer-ID abgebildet; Berechtigungen hängen an der CMS-ID.

Die endgültige eigene Anmeldung wird in einer separaten, eigenständig betriebenen lokalen/Testumgebung entwickelt und getestet. Sites-Demos kennzeichnen den jeweiligen Anmeldemodus eindeutig. Eine erfolgreiche Sites-Anmeldung ist kein Test der späteren Kennwortanmeldung. Aus Sites-Plattformkonten lassen sich keine Kennwörter für das eigene CMS exportieren. Benutzer, die bisher nur die Plattformanmeldung genutzt haben, aktivieren beim Wechsel ihr eigenes Konto durch einen verifizierten Vorgang.

## Release und Datensicherung

1. Release-ZIP: Quellcode, Lockdatei, Buildanleitung, Datenbankmigrationen, Konfigurationsvorlage ohne Geheimnisse, Containerkonfiguration, Originalassets und Betriebsanleitung. Lizenzen beachten, Schriftdateien nur mit passender Lizenz beilegen.
2. Separates geschütztes Datenpaket: versioniertes Exportformat mit Inhalten, internen Benutzer-IDs, Rollen, Standortzuordnung, Dateimanifest und Dateien. Existierende eigene Passworthashes nur im geschützten Backup; aktive Sitzungen und abgelaufene Einladungstokens nicht als übertragbare Zugänge behandeln.
3. Geheimnisse: separat sicher übertragen oder neu setzen. Abhängigkeiten etwaiger verschlüsselter Daten von Schlüsseln dokumentieren. Keine Kennwörter, API-Schlüssel oder produktiven Benutzerdaten im normalen Release-ZIP.
4. Wiederherstellung: auf leerer Zielinstallation einlesen, Datensatz- und Dateianzahlen sowie Prüfsummen vergleichen, Rollen und gesperrte Konten testen. Nach endgültigem Umzug neue Anmeldung verlangen.
5. Betrieb: HTTPS, persistente Volumes, Aktualisierungen, externe Backups, Wiederherstellungsproben und dokumentierter Rückweg. DNS und E-Mail-Konfiguration getrennt vom Anwendungscode behandeln.

## Erste Umsetzung und Prüfungen

1. Minimale Anwendung in Sites und auf eigenständiger Laufzeit starten.
2. Testbeitrag und Datei speichern, exportieren und auf leerem Ziel wiederherstellen.
3. Interne CMS-Benutzer und serverseitige Rechte implementieren; Sites-Identität und eigene Testanmeldung über getrennte Anbindungen zuordnen.
4. Einladung, Passwortsetzen, Anmeldung, Abmeldung und Wiederherstellung auf der eigenen Laufzeit testen. Nicht berechtigte Aufrufe müssen auch ohne Oberfläche abgewiesen werden.
5. Danach CI-Oberfläche, Seiten, Beiträge, Standortfilter und Freigaben ausbauen.

Keine produktiven Lehrkräftedaten notwendig, bevor dieser technische Durchstich mit erfundenen Testkonten bestanden ist.

## Gestaltung

BSVG-CI-Manual als visuelle Referenz: Poppins für die vorgeschlagene Weboberfläche, Schriftblaugrau #365B6D, Flächenblaugrau #EEF4F5, Linienblaugrau #C7D6DC und gezielte CI-Akzente. Originallogo unverändert übernehmen; abweichende im Originalasset enthaltene Farben nicht automatisch angleichen. Word-Vorlagenregeln nicht auf das Web übertragen. Fehlende Markenassets nicht nachzeichnen.

## Fachliche Quellen

- Sites-Skill und lokale Referenzen: unterstützte Laufzeit, Plattformidentität, D1/R2 und Quellcode-Veröffentlichungsablauf.
- Vom Nutzer bereitgestelltes BSVG-CI/CD-Visual-Language-Manual und Original-SVG.
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html

Die referenzierten Dokumente liefern fachliche beziehungsweise visuelle Vorgaben. Der aktuelle Nutzerauftrag bestimmt Umfang und Ziel der Umsetzung.
