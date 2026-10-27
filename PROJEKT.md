# Flugduell – Projektbeschreibung

Live-Quiz fürs iPhone: Ein echter Linienflug, der gerade in der Luft ist, wird angezeigt (Airline, Route, Höhe, Tempo, Live-Karte). Die Spieler erraten den Flugzeugtyp (Airbus/Boeing, Modell reicht, z. B. A330).

## Links und Konten
- App: https://bollinger7310.github.io/flugduell/ (GitHub Pages, Branch `main`, Ordner `/`)
- Code: https://github.com/Bollinger7310/flugduell (öffentlich, „Alle Rechte vorbehalten“, siehe LICENSE)
- Weiterleitung: https://flugduell-proxy.hendrik-bollinger.workers.dev (Cloudflare Worker, baut automatisch aus `worker.js` bei jedem Push auf `main`)
- Besitzer: Hendrik Bollinger. Nur er (und Claude über seine Freigabe) ändert den Code.

## Dateien
- `index.html` – die komplette App (HTML, CSS, JS in einer Datei, Leaflet 1.9.4 von cdnjs, Schriften Geist / Geist Mono)
- `worker.js` + `wrangler.toml` – Cloudflare-Weiterleitung mit CORS, nur für die App-Adresse freigegeben, Zwischenspeicher und Wiederholung bei HTTP 429
- `manifest.json`, `icon-180.png`, `icon-512.png` – App-Icon für den Home-Bildschirm
- `LICENSE`, `README.md`, `PROJEKT.md`

## Datenquellen (alle über die Weiterleitung)
- Live-Positionen: nur adsb.lol über die Weiterleitung (adsb.fi, airplanes.live und direkte Abrufe sind gesperrt und wurden entfernt). Abrufe mit bis zu 3 Versuchen; bei Netzproblemen Meldung „Verbindung zu schwach“/„Keine Internetverbindung“ und automatische neue Suche.
- Routen: adsbdb.com (Callsign → Abflug/Ziel)
- Fotos: planespotters.net, laut deren Bedingungen DIREKT aus dem Browser abfragen (nicht über die Weiterleitung, sonst 403), Bild vom Browser laden, Fotograf nennen, Bild auf Fotoseite verlinken
- Karte: Esri World Dark Gray / World Imagery (Satellit)
- Bisheriger Flugverlauf (globe.adsb.lol): von Cloudflare aus gesperrt (403) → Spur wird ab Spielbeginn live aufgezeichnet
- Nur private, nicht-kommerzielle Nutzung. Für kommerziell: lizenzierte Daten nötig (z. B. Flightradar24-API, Explorer 9 $/Monat).

## Spielfunktionen
- Startbildschirm: Kacheln Singleplayer / 1 vs 1, darunter Abzeichen und Spielregeln; Tipp auf Kachel öffnet „Spiel einrichten“ (Namen nur bei 1 vs 1, Flugzeuge, Gebiet, Runden, letzte Auswahl voreingestellt). Modi: Singleplayer oder Lokal 1 vs 1 (Standardnamen „Player 1“ / „Player 2“, änderbar)
- Flugzeuge: Langstrecke (A330, A340, A350, A380, B747, B767, B777, B787), Kurz- & Mittelstrecke (A220, A319–A321, B737, B757), Alle Typen. Boeing wird in der Anzeige immer mit „B“ geschrieben (intern ohne, Funktion disp())
- Gebiet: Weltweit oder „Über mir“ (Standort, nächster Flug im Umkreis 100 nm, dann 250 nm; zeigt Entfernung/Richtung)
- Matchlänge: 5, 10, Endlos oder eigene Zahl (1–99); Ergebnis-Bildschirm mit Statistik und „Revanche“
- Tippen: erst Freitext, optional „3 Typen zeigen“ → Multiple Choice (nur echte Flottentypen der Airline, plausibel für die Streckenlänge)
- Punkte: +2 Freitext, +1 Auswahl, +1 Bonus für exaktes Submodell (z. B. A350-1000, 77W)
- 1 vs 1: Tipps verdeckt; Singleplayer: sofortige Auflösung
- Auflösung: Typ laut Transponder, Submodell, Kennzeichen, Foto, Link zu Flightradar24
- 23 Abzeichen im Singleplayer (dauerhaft gespeichert, Einblendung beim Freischalten, Übersicht im Menü)
- Abwechslung: Modell und Airline der letzten 2 Runden werden nicht wiederholt; kürzlich gespielte und im Gebiet häufige Typen werden abgewertet
- Ausgeschlossen: Fracht, Privat, Militär, alles außer Airbus/Boeing

## Design
Ruhiger Instrumenten-Look, nicht „Arcade“: Haarlinien statt Schatten, eine Signalfarbe Bernstein (#F0B44C dunkel / #B9781A hell), Zahlen in Monospace, Hell- und Dunkelmodus nach iPhone. Karte im Navigationskarten-Stil: Esri Dark Gray blau getönt, Koordinatengitter, Vignette, Instrumentenanzeige (FL, Kurs, V/S), gelbes Flugzeug, Spur nach Höhe eingefärbt, gestrichelte Linie nur vom Flugzeug zum Ziel.

## Arbeitsweise
- Nutzer arbeitet am iPhone, ohne Programmierkenntnisse: Anleitungen Schritt für Schritt, auf Deutsch.
- Änderungen direkt auf `main` pushen; GitHub Pages und Cloudflare aktualisieren in 1–2 Minuten.
- Spielstand und zuletzt geöffneter Bildschirm (S.view) liegen im localStorage (Schlüssel `flugduell-v3`); bei Strukturänderungen alten Stand migrieren statt löschen.

## Ideen für später
Profi-Schwierigkeit (Airline ausgeblendet), Lernkarte mit Erkennungsmerkmalen, gestufte Hinweise gegen Punktabzug, Statistik der Verwechslungen, Rundentimer, Online 1 vs 1, Flightradar24-API.
