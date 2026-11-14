# Tracky

Kleine Web-App für den Projektunterricht (Gruppe 22). Sie hält fest, was in den
drei Lektionen gelaufen ist, und lädt am Schluss **eine** Datei herunter: ein
`.zip` mit den Notizen und den Fotos. Aus diesem Zip baut der Bot den fertigen
Wochenrapport als `.docx` — mit der Vorlage und im Schreibstil der jeweiligen
Person.

## So wird es benutzt

1. **Person wählen** — Vlad oder Dorian. Das entscheidet über Vorlage, Stil und
   Dateinamen des Rapports.
2. **Datum** der Lektion eintragen (Lektionsbeginn ist freiwillig).
3. **Lektion 1–3**: nur Stichpunkte, keine Sätze — «Firmware weitergebracht, neuer
   Spielmodus angefangen». Den Rapporttext schreibt Hermes daraus. Pro Lektion
   gehört ein Foto dazu (Handyfoto — kein Bildschirmfoto).
4. **Positives / Negatives / Gelernt / nächste Woche** sind freiwillig. Leer
   gelassen schreibt Hermes sie aus den Lektionen.
5. **Download .zip** drücken und die Datei an den Bot schicken.

Die Infos von Frau Stalder stehen nicht in Tracky: sie kommen aus der
Lektionsaufnahme (`Wochenrapporte/transkripte/<datum>.json`).

Der Entwurf wird laufend lokal im Browser gespeichert (IndexedDB). Es gibt keinen
Server, kein Konto und keine Übertragung: Hochgeladen wird nur, was man selbst
per Discord weitergibt.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Aufbau der Seite |
| `style.css` | Gestaltung (hell, für Handy und Laptop) |
| `app.js` | Felder, Autosave, Bildverkleinerung, Export |
| `zip.js` | kleiner ZIP-Writer ohne Fremdbibliothek |

## Format des Exports

```json
{
  "format": "tracky/2",
  "person": "vlad",
  "datum": "2026-11-24",
  "lektion_start": "07:45",
  "lektionen": [
    { "notizen": "Firmware weitergebracht, neuer Spielmodus angefangen",
      "bilder": ["bilder/l1_1.jpg"] }
  ],
  "positives": [],
  "negatives": [],
  "gelernt": [],
  "naechste_woche": []
}
```

Bilder werden im Browser auf 1600 px verkleinert und als JPEG gespeichert, damit
der Export klein bleibt.

## Verarbeitung

```
py -3 Wochenrapporte/_src/from_tracky.py tracky_vlad_24.11.2026.zip
py -3 Wochenrapporte/_src/build_rapport.py Wochenrapporte/inhalt/<person>/<datum>.json --person <person>
```

Der Import prüft den Export, legt die Bilder unter
`Wochenrapporte/bilder/<person>/<datum>/` ab, zieht die Infos von Frau Stalder aus dem
Transkript, formuliert sie im Stil der Person um und ordnet sie nach Thema. Ergebnis ist
`Wochenrapporte/inhalt/<person>/<datum>.json` mit `status: "entwurf"` — dort trägt
Hermes die Lektionsabsätze und die Auswertung ein, setzt `status: "fertig"` und baut
daraus `02_Rapporte/Wochenrapport <Name> <datum>.docx`.
Vorlage, Stil und die wiederkehrenden Infos stehen in `Wochenrapporte/profil/<person>.json`.

## Ohne Server testen

```
py -3 -m http.server 8765 --directory tracky
```

dann <http://127.0.0.1:8765/> öffnen. Über `file://` blockiert Chrome die
IndexedDB-Speicherung.
