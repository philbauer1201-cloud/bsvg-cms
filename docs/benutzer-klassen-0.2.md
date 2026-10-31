# Benutzer, Klassen und Mitgliedschaften – Stand 0.2

Stand: 31.10.2026. Die Kontenverwaltung ist die gemeinsame Grundlage für Lehrkräfte-Intranet, geschützten Schülerbereich und spätere Klassenkommunikation.

## Umgesetzt

- Stabile interne Benutzerkennungen, normalisierte eindeutige E-Mail-Adressen, optionale Anzeigenamen, Rollen und Kontostatus.
- Lehrkraft und Administration können Rollen desselben Kontos sein. Schülerkonten erhalten ausschließlich die Schülerrolle. Redaktion ist eine separate Inhaltsrolle.
- Konten sind zunächst `pending` (Aktivierung ausstehend), können gesperrt werden und werden nicht über die Verwaltungs-API aktiv geschaltet.
- Lehrgangsklassen besitzen eigene Kennungen, Namen, Lehrgang, Standort, Beginn, Ende und Archivstatus. Ende gilt einschließlich, nach Kalenderdatum in Europe/Vienna.
- Lehrkräfte und Schüler können mehreren Klassen zugeordnet werden. Jede aktive Klassenmitgliedschaft muss zur Rolle des Kontos passen. Doppelte aktive Zuordnungen werden abgewiesen. Entfernte Mitgliedschaften bleiben als beendet nachvollziehbar.
- Serverseitige Rechteprüfung und lesende Berechtigungsvorschau, optional mit eindeutig gekennzeichneter hypothetischer Aktivierung. Diese Vorschau ändert keinen Kontostatus.
- Exportformat 2 enthält das Verzeichnis einschließlich Kennungen, Rollen und Mitgliedschaften. Format 1 bleibt als Inhaltsimport lesbar und lässt das bestehende Verzeichnis unberührt. Beim Import von Format 2 werden zuvor aktive Konten zurück auf `pending` gesetzt. Plattformidentitäten, Sitzungen und Passwörter sind nicht Bestandteil dieser Version des Exports.

## Rechtegrenzen

| Rolle | Konten/Klassen verwalten | Redaktionelle Inhalte bearbeiten | Lehrkräfte-Inhalte lesen | Klassenzugriff | Vollsicherung |
|---|---|---|---|---|---|
| Administration | ja | ja | ja | alle, auch geplante Klassen | ja |
| Redaktion | nein | ja | ja | kein allgemeiner Klassenzugriff | nein |
| Lehrkraft | nein | nein, sofern nicht zusätzlich Redaktion | ja | nur zugeordnete laufende Klassen; Ankündigungen dort künftig möglich | nein |
| Schüler | nein | nein | nein | nur eigene laufende Klassen; Antworten später nur bei geöffneter Diskussion | nein |

Ein nicht aktiviertes oder gesperrtes Konto erhält durch diese Rollen und Mitgliedschaften noch keinen Zugang. Die derzeitige Werkstatt wird vom Betreiber verwaltet und ist ein getrennter Administrationskontext. Auf Sites bleibt sie ausschließlich owner-private; eine zusätzliche Freigabe ist nicht Teil dieses Ausbaus. CMS-Identitäten werden niemals allein durch einen E-Mail-Vergleich mit der Plattformidentität verbunden. Der eigene Node-Server verwendet vorerst weiterhin den separaten Test-Administrationszugang.

Redaktionelle Schülerbeiträge können serverseitig mit einer Klasse verbunden werden. Schüler erhalten nur veröffentlichte Inhalte der eigenen laufenden Klassen; Entwürfe, interne Dateien, Aktivitätenprotokolle und fremde Benutzerverzeichnisse bleiben gesperrt. Die bisherige Mediathek gilt als interner Bestand; Dateien für Schüler benötigen im späteren Materialbereich ausdrücklich zugeordnete Freigaben.

## Noch offen

Verifizierte Kontoaktivierung, eigene Passwortanmeldung, Einladungs- und Wiederherstellungsversand, Konto- und Sitzungsverknüpfung, Mehrfaktor-Anmeldung sowie die eigentliche Schüler-/Lehrkräfte-Oberfläche und Klassenkommunikation. Es werden keine Einladungen oder sonstigen Nachrichten versendet.

Die konkret angeforderten Testkonten und Klassendaten werden als Laufzeitdaten in der privaten Installation angelegt. Sie stehen nicht im Quellcode, in automatisierten Testfixtures oder im Release-ZIP.

## Prüfungen

Sechs automatisierte Tests: eindeutige Konten und Mehrfachrollen, passende und eindeutige Mitgliedschaften, fehlende Aktivierung, lesende Simulation, Rollenabweisung direkt an den APIs, fremde Klassen, Schüler-/Lehrkräfte-Inhalte, Beginn-/Endtag und Wiener Datumswechsel, Backups mit Verzeichnis, ungültige Verweise, Rückwärtskompatibilität und Aktivierungsrücksetzung. Weiterhin die vorhandenen Datei-, SQLite-, Anmelde- und CSRF-Prüfungen.

Die Rollenfunktion wird mit synthetisch aktivierten Testidentitäten geprüft. Ein echter Login als Lehrkraft oder Schüler wird damit noch nicht behauptet. Browserprüfung: Konto mit mehreren Rollen vorbereiten, Klasse mit österreichischem Datumsformat speichern und Konto der Klasse zuordnen.
