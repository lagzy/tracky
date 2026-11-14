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
3. **Infos von Frau Stalder** als Rohnotizen, eine Zeile pro Info. Stichworte
   genügen: «Abmeldung bis Freitag 12 Uhr». Die Sätze werden später neu
   formuliert und neu geordnet.
4. **Lektion 1–3**: was gemacht wurde, mit Zahlen. Frau Stalder verlangt
   mindestens 4 Sätze pro Lektion; der Zähler neben dem Feld zeigt, wo man steht.
   Pro Lektion gehört ein Foto dazu (Handyfoto — kein Bildschirmfoto).
5. **Positives / Negatives / Gelernt / nächste Woche** ausfüllen. «Gelernt» ist
   freiwillig.
6. **Download .zip** drücken und die Datei an den Bot schicken.

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
  "format": "tracky/1",
  "person": "vlad",
  "datum": "2026-11-24",
  "lektion_start": "07:45",
  "infos": ["Abgabe Dokumappe 1. Dezember, zwei gebundene Mappen"],
  "lektionen": [
    { "text": "…", "bilder": ["bilder/l1_1.jpg"] }
  ],
  "positives": ["…"],
  "negatives": ["…"],
  "gelernt": ["…"],
  "naechste_woche": ["…"]
}
```

Bilder werden im Browser auf 1600 px verkleinert und als JPEG gespeichert, damit
der Export klein bleibt.

## Verarbeitung

```
py -3 Wochenrapporte/_src/from_tracky.py tracky_vlad_24.11.2026.zip
```

Das Skript prüft den Export, legt die Bilder ab, formuliert die Infos von Frau
Stalder im Stil der Person um, schreibt `Wochenrapporte/inhalt/<person>/<datum>.json`
und baut daraus `02_Rapporte/Wochenrapport <Name> <datum>.docx`.
Vorlage und Stil stehen in `Wochenrapporte/profil/<person>.json`.

## Ohne Server testen

```
py -3 -m http.server 8765 --directory tracky
```

dann <http://127.0.0.1:8765/> öffnen. Über `file://` blockiert Chrome die
IndexedDB-Speicherung.
