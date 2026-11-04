# Ballers Club

Eigenständiges Modul unter `src/modules/ballersclub`: Konfiguration, XLSX-Parser,
Import-Service, Datenzugriff, Hallenauflösung und lesende REST-Routen. Der allgemeine
Basar bindet es über `catalogRepository.js` ein. Es schreibt weder ins Google Sheet
noch versendet es Bewerbungen.

## Konfiguration und Betrieb

`.env.ballersclub.example` als Vorlage verwenden. Die echte `.env.ballersclub`
bleibt außerhalb von Git. Auf dem bestehenden Server liegt sie unter
`/var/www/clients/client2/web3/private/shared/.env.ballersclub` (Modus `0640`,
Eigentümer `root`, Gruppe des PM2-Laufzeitkontos; auf dem bestehenden Server
`client2`). `ops/deploy.sh` stellt diese Leserechte vor jedem Import sicher und
verlinkt die Datei in jedes Release. Die allgemeine `.env` bleibt unverändert.

Variablen: `BALLERSCLUB_ENABLED`, `BALLERSCLUB_SHEET_URL`, `BALLERSCLUB_PHONE`
(internationale Ziffern, ohne Plus), `BALLERSCLUB_EMAIL`, `BALLERSCLUB_CONTACT_NAME`,
`BALLERSCLUB_DAYS_AHEAD` (21). Optional `BALLERSCLUB_SHEET_NAME` bei mehreren Blättern
und `BALLERSCLUB_ENV_FILE` für einen anderen Dateipfad. Prozessvariablen haben Vorrang.
Die Tabelle muss anonym als XLSX exportierbar sein. Der Import und der PM2-Prozess
laufen unter demselben Laufzeitkonto, damit ein root-exklusiver Deploy-Import keine
falsche Sicherheit über die Lesbarkeit der Produktions-ENV erzeugt.

Der Import läuft alle fünf Minuten ausschließlich im PM2-Worker 0. Jeder erfolgreiche
Import ersetzt den Quellen-Snapshot in einer Transaktion. Bei Fehlern bleibt der letzte
gute Stand maximal 15 Minuten sichtbar, danach werden nur Ballers-Turniere ausgeblendet.
Ein erfolgreicher leerer Import ist gültig; eine beschädigte Tabelle löscht nichts.
Beim Deployment: Produktions-Audit, Abhängigkeiten, Datenbank-Backup, additive Migration,
Hallen-Backfill, Import und lesende Katalog-Prüfung vor der Release-Aktivierung.

## Freie Plätze und Datenschutz

Der XLSX-Parser benötigt die Zellformatierung; CSV genügt nicht. Ein leerer gelber
Platz in der Spalte „Schiedsrichter“ ist frei, eine beschriftete gelbe Zelle belegt.
Die Kapazität kommt aus der tatsächlichen Anzahl gelber Plätze, nicht aus einer
festen Sollzahl pro Turniertyp. Verbundene Zellen werden einmal gezählt. Bewerbungen
in anderen Spalten beeinflussen die freien Plätze nicht.

Gespeichert werden nur Turnierdaten, Kapazitäten und Hallenbezüge, keine Namen von
Schiedsrichtern oder Bewerbern. Nur `freeSpots > 0` gelangt in den öffentlichen Katalog.
Das Zeitfenster umfasst heute bis einschließlich heute + 21 Tage in Europe/Berlin;
beendete Turniere und Puffer-/spielfreie Einträge entfallen. „TBA“ bleibt „Uhrzeit folgt“.

## API

- `GET /v1/spiele?source=all`: TeamSL und Ballers Club, gemeinsam gefiltert,
  sortiert und **vor** der Pagination zusammengeführt.
- `GET /v1/spiele?source=team-sl`: ausschließlich bestehende Spiele.
- `GET /v1/ballersclub/spiele`: ausschließlich Ballers Club, gleiche Abfrageparameter.
- `GET /v1/ballersclub/status`: Verfügbarkeit, Aktualisierungszeit und öffentliche
  Kontaktdaten; keine interne Sheet-URL.

IDs sind quellenübergreifend eindeutig (`team-sl:…`, `ballers-club:…`). Die bestehende
`spielplanId` bleibt für TeamSL erhalten und ist bei Ballers `null`. Es gibt dort keine
erfundene Mindestlizenz oder Heim-/Gastmannschaft. Ballers-Einträge enthalten zusätzlich
`tournamentId`, `tournamentType`, `timeLabel`, `meetingTime`, `freeSpots`, `totalSpots`,
`endTimestamp`, `sourceHallName` und `hallId`. Quellenstatus und Kontakt stehen in
`data.sources.ballersClub`. Lizenz- und Ausfallfilter gelten weiterhin nur für passende
Einträge; sie dürfen Ballers-Turniere ohne Lizenzvorgabe ausschließen.

## Hallenhistorie und manuelle Zuordnung

`hallen` ist ein permanentes Verzeichnis aus Spielplan-Hallennamen und Adressen mit
eigenen stabilen IDs. Die externe TeamSL-ID wird zusätzlich gespeichert, sofern die
Quelle sie liefert. Das Löschen alter Spiele löscht keine Hallen. Bekannte Koordinaten
werden wiederverwendet; `geocoding_cache` speichert Treffer sowie erfolglose Versuche
(24 Stunden) und Fehler (15 Minuten). Parallelzugriffe erhalten eine kurze DB-Sperrfrist.
Das bestehende Geocoding verwendet Photon; rohe Ballers-Namen werden nie extern geocodiert.

Automatisch werden nur eindeutige normalisierte Hallennamen zugeordnet. Stockwerke
werden nicht geraten. `(Anschluss)`, Pfeilmarkierungen und `(bei Bedarf anfragbar)`
sind keine eigenen Hallen. Unklare Angaben wie „Hausburg ???“ bleiben offen.

Vor einer manuellen Zuordnung die tatsächlichen IDs prüfen:

```sql
SELECT id, name, street, postal_code, city FROM hallen ORDER BY name;
SELECT id, source_name, normalized_name, hall_id, manual
FROM ballersclub_hallen_mapping ORDER BY source_name;
```

Danach im aktiven Backend-Release ausführen (ID vorher bestätigen):

```sh
node ops/mapBallersHall.js "Name im Google Sheet" BESTAETIGTE_HALLEN_ID
```

`none` statt einer ID verhindert eine automatische Zuordnung ausdrücklich. Das Skript
validiert die Zielhalle und aktualisiert Mapping und betroffene Turniere atomar.
Manuelle Zuordnungen überleben weitere Imports. Direktes SQL ist ebenfalls möglich:
`hall_id` und `manual = 1` für die zuvor geprüfte Mapping-ID setzen; die Anzeige wird
dann beim nächsten Import aktualisiert. Keine Zuordnungen allein anhand ähnlich
klingender Namen vornehmen.

## Frontend

Das separate Vue-Modul bietet Kachel, Tabellenzeile und Dialog. Name, Alter und Lizenz
bleiben im geöffneten Dialog und werden weder dauerhaft gespeichert noch an die API
übermittelt. WhatsApp (`wa.me`) und E-Mail (`mailto`) öffnen nur vorausgefüllte Entwürfe.
Der Nutzer sendet selbst; die Aktion reserviert keinen Platz.

## Prüfung

Vor Tests und jedem Deployment `npm run audit:production`. High/Critical blockieren;
ein reiner Registry-Ausfall wird als **nicht bestanden/übersprungen** protokolliert
und muss bei Verfügbarkeit nachgeholt werden. Danach `npm test -- --runInBand`.
