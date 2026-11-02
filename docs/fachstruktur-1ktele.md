# Fachstruktur für die Testklasse 1kTELE

Arbeitsstand für die Implementierung. Die Zuordnungen sind noch keine wirksamen Berechtigungen.

- Standort: Vöcklabruck; Testzeitraum: 01.11.2026 bis einschließlich 09.02.2027.
- Klassenvorstand: Philipp Bauer.
- Zuständig für Verkaufspraktikum (VKP) und Verkaufskompetenz und Persönlichkeitsentwicklung (VP): Philipp Bauer.

| Kürzel | Fach | Art |
| --- | --- | --- |
| AWL | Angewandte Wirtschaftslehre | Pflichtgegenstand |
| BFE | Berufsbezogene Fremdsprache Englisch | Pflichtgegenstand |
| BWPP | Betriebswirtschaftliches Projektpraktikum | Pflichtgegenstand |
| DUK | Deutsch und Kommunikation | Pflichtgegenstand |
| VFW | Verkaufsförderung und Warenpräsentation | Pflichtgegenstand |
| VKP | Verkaufspraktikum | Pflichtgegenstand |
| VP | Verkaufskompetenz und Persönlichkeitsentwicklung | Pflichtgegenstand |
| PB | Politische Bildung | Pflichtgegenstand |
| FFÖU | Förderunterricht | Freigegenstand |
| FRL | Religion | Freigegenstand |

## Anforderungen für den Ausbau

Fächer, Klassen und Lehrkräfte müssen unabhängig voneinander verwaltbar und pro Lehrgang zuordenbar sein. Klassenvorstand ist eine Funktion einer Lehrkraft in einer konkreten Klasse. Pflicht- und Freigegenstände müssen unterscheidbar sein; eine Teilnahme an Freigegenständen darf nicht automatisch angenommen werden.

Allgemeine und fachbezogene Informationen getrennt ausgeben. Beiträge sollen mehrere Klassen oder einen Lehrgang sowie Lehrkräfte, Schüler und Klassenvorstände als Empfänger kombinieren können. Standorte und persönliche Fach- und Klassenmitgliedschaften sind serverseitig zu prüfen. Administrationsrechte und redaktionelle Zuständigkeiten sind getrennt festzulegen.

Fachzuordnungen und Funktionen müssen beim Export und Wiederherstellen mit gesichert und validiert werden. Bestehende Konten, Passwörter, Klassen und Beiträge müssen erhalten bleiben. Ein Test muss fremde Klassen und Dateien gegen unberechtigten Zugriff prüfen. Diese Funktionen existieren im aktuellen Grundgerüst noch nicht.
