# BSVG CMS – Projektübersicht und Aufgaben

Arbeitsstand: 03.11.2026. Anforderungen aus dem bisherigen Gespräch; offene Punkte sind keine Zusage, dass die Funktion bereits umgesetzt ist.

## Gemeinsame Grundlage

- Eine Schule mit den Standorten Vöcklabruck und Gmunden; Standortauswahl zur Orientierung, serverseitige Berechtigungen unabhängig davon.
- Öffentliche Schulwebsite, geschütztes Lehrkräfte-Intranet, geschützter Schülerbereich und Verwaltung. Persönliche Informationen erst nach Anmeldung.
- Eigene Konten ohne Microsoft-Pflicht; portabler Betrieb auf eigenem Server, einschließlich Sicherung und getesteter Wiederherstellung.
- Seiten, Stammdaten, Dokumente und Berechtigungen durch berechtigte Personen im CMS pflegen.
- Bestehende Schulwebsite: allgemeine Informationen künftig aus dem CMS bereitstellen; Darstellung und technische Integration prüfen. Nachrichten vorerst bei Bedarf auf der bisherigen Website pflegen.

## IBA – nächstes Funktionspaket

Vorhanden: CSV-Datenstand für Vöcklabruck mit Filtern und Detailansicht; Zugriff derzeit auf die Administration begrenzt. Das Gesprächsformular ist eine nicht speichernde Vorschau. PDF-Anlagen und personalisierte IBA-Rollen sind noch nicht umgesetzt.

- [ ] Berechtigte Personen können neue Schüler*innen anlegen sowie bestehende Datensätze öffnen, bearbeiten, speichern und erneut öffnen. Erstellungs- und Änderungszeit sowie verantwortliche Person nachvollziehbar halten; Lese- und Bearbeitungsrechte getrennt prüfen.
- [ ] Übersicht und Details aufgeräumt nach Person und Ausbildung, Gespräch und Betreuung, Besonderheiten und Änderungen sowie Anlagen gliedern. Leere Felder erkennbar darstellen.
- [ ] IBA-Status als pflegbare Auswahlliste: vorhandene Statuswerte aus importierten Datensätzen berücksichtigen; berechtigte Personen können fehlende Werte manuell ergänzen. Keine vollständige Liste erfinden. Freitext und Varianten kontrollieren, bestehende Werte bei Änderungen erhalten.
- [ ] Schuljahr, Klasse und Lehrgang aus gepflegten Daten anbieten und bei Bedarf durch berechtigte Personen ergänzen. „LG“ im Import als „Lehrgang“ verstehen; vorhandene Werte wie „LG 2“ erhalten und einheitlich anzeigen, ohne sie doppelt zu präfixieren.
- [ ] A4-Druckansicht eines einzelnen Datensatzes für die externe Ordnerablage: lesbare Gliederung, Druckdatum, sinnvolle Seitenumbrüche und optionales Speichern als PDF über den Druckdialog. Nur berechtigte Inhalte ausgeben.
- [ ] Gesprächsprotokolle als PDF einem Eintrag zuordnen, geschützt speichern und herunterladen. Dateityp und Größe prüfen; Dateien in Sicherung und Wiederherstellung aufnehmen.
- [ ] CSV-Import: Vorschau und Prüfung vor Übernahme; Konflikte mit manuell gepflegten Daten sichtbar machen. Standortweise Ersetzung darf Änderungen und Anlagen nicht stillschweigend verlieren. Eindeutige stabile IDs und Umgang mit fehlenden oder doppelten IDs festlegen.
- [ ] Bestehende Betreuer*innen aus dem Datenbestand durchsuchbar anbieten; zusätzliche Kontakte durch berechtigte Personen pflegen. Externes Verzeichnis als Quelle verlinken; Aktualität und Übernahme separat prüfen.
- [ ] Ende-zu-Ende-Prüfung: Import → bestehenden Eintrag bearbeiten → speichern → erneut öffnen → A4 drucken/PDF speichern → sichern und wiederherstellen. Nicht berechtigte Konten dürfen weder Einträge noch PDFs lesen oder ändern; parallele Änderungen dürfen nicht unbemerkt überschrieben werden.

## Weitere Funktionspakete

- [ ] Untis-Supplierungen: Excel-Import, Vorschau, Klärung der Kürzel, eindeutige Zuordnung zu Klassen und Lehrkräften, Freigabe, Filter und persönliche Dashboards.
- [ ] Intranet: Navigation und Standortauswahl, Informationen und Downloads, Unterrichtsorganisation, IBA, Leitung, SGA, Pausenaufsicht, Klassenmanagement und Formulare. Rollen und redaktionelle Zuständigkeiten je Bereich festlegen.
- [ ] Raumübersicht und andere bestehende Sites prüfen; Daten und Funktionen in eigenes Layout integrieren, Zugriffsrechte und Aktualisierung klären.
- [ ] Formulare, Anträge und Genehmigungen für Exkursionen/Lehrausgänge; optionale Outlook-Kalenderintegration nach Prüfung. Kollegiale Hospitation und Leitungsvertretung ergänzen.
- [ ] Klassenkommunikation nach stabiler gemeinsamer Grundlage: allgemeine und fachbezogene Informationen, Klassen- und KV-Zuordnung, Materialien und später Antworten.
