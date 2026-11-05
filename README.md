# jellyfin-frontend

Web- und Mobil-Frontend für [Jellyfin](https://jellyfin.org) mit der Bedienung eines großen Streaming-Dienstes: Billboard, Slider-Reihen, Hover-Vorschau, Detail-Fenster, Profile und ein Vollbild-Player. Gebaut mit Vite, React und TypeScript. Geprüft gegen Jellyfin 12.4.

## Starten

```bash
npm install
npm run dev        # http://localhost:5173
```

Beim ersten Aufruf fragt die App nach der Serveradresse. Zum Ausprobieren ohne eigenen Server: `https://demo.jellyfin.org/stable`, Benutzer `demo`, leeres Passwort.

| Befehl | Zweck |
| --- | --- |
| `npm run build` | Typprüfung und Produktions-Build nach `dist/` |
| `npm run preview` | Build lokal ausliefern |
| `npm test` | Unit-Tests |

## Konfiguration

Beide Variablen sind optional und werden über eine `.env`-Datei gesetzt (siehe `.env.example`):

| Variable | Wirkung |
| --- | --- |
| `VITE_JELLYFIN_SERVER` | Füllt die Serveradresse auf der Verbinden-Seite vor |
| `VITE_APP_NAME` | Name im Logo-Schriftzug (Standard: `Jellyfin`) |

## Deployment

`dist/` ist eine statische Single-Page-App. Der Webserver muss unbekannte Pfade auf `index.html` umleiten, zum Beispiel bei nginx:

```nginx
location / {
  try_files $uri /index.html;
}
```

- **CORS:** Liegt das Frontend auf einer anderen Adresse als der Server, muss Jellyfin diese Herkunft erlauben (Standard: alle). Für Untertitel und Trickplay sind die CORS-Header ebenfalls nötig.
- **HTTPS:** Eine über HTTPS ausgelieferte App kann keinen HTTP-Server erreichen, das blockiert der Browser.
- **Mobil:** Die App lässt sich über das Web-App-Manifest zum Home-Bildschirm hinzufügen.

## Abbildung auf die Jellyfin-API

| In der App | Jellyfin |
| --- | --- |
| Profile | Benutzer (`/Users/Public`), ein Token pro Benutzer im `localStorage` |
| Anmeldecode | Quick Connect |
| Meine Liste | Favoriten (`/UserFavoriteItems`) |
| Daumen hoch/runter | `Likes` (`/UserItems/{id}/UserData`) |
| Weiterschauen, Nächste Folgen | `/UserItems/Resume`, `/Shows/NextUp` |
| Weil du … angesehen hast | `/Movies/Recommendations` |
| Top 10 | Nach `CommunityRating` sortiert, denn Jellyfin kennt keine Abrufzahlen über alle Benutzer |
| Prozentwert in Grün | `CommunityRating` × 10, keine persönliche Übereinstimmung |
| Video-Vorschauen | Lokale Trailer oder Titelvideos (`ThemeMedia`) |
| Intro überspringen | `/MediaSegments`, setzt einen Segment-Anbieter auf dem Server voraus |
| Vorschaubilder im Player | Trickplay, muss auf dem Server aktiviert sein |
| Wiedergabe | `PlaybackInfo` mit einem aus dem Browser ermittelten `DeviceProfile`: Direct Play, sonst HLS-Transcoding über hls.js |
| Resume-Punkte | `/Sessions/Playing`, `/Progress`, `/Stopped` |

Jellyfin verwirft Positionen unterhalb von `MinResumePct` (Standard 5 % der Laufzeit). Ein früh abgebrochener Film beginnt deshalb wieder von vorn.

## Tastenkürzel im Player

| Taste | Aktion |
| --- | --- |
| Leertaste, `K` | Abspielen/Pause |
| `←` `→`, `J` `L` | 10 Sekunden zurück/vor |
| `↑` `↓` | Lautstärke |
| `M` | Ton aus/an |
| `F` | Vollbild |
| `S` | Intro oder Rückblick überspringen |
| `N` | Nächste Folge |
| `Esc` | Panel schließen, sonst zurück |

Auf Touch-Geräten: Tippen blendet die Steuerung ein, Doppeltippen links oder rechts springt 10 Sekunden.

## Erscheinungsbild

- **Schriften:** Inter und Bebas Neue werden lokal mitgeliefert (`@fontsource`, Lizenz OFL 1.1), die App lädt keine Schriften von fremden Servern.
- **Profilbilder:** Benutzer ohne Bild in Jellyfin bekommen eine feste, aus der Benutzer-ID erzeugte Kachel.
- **Poster-Wand:** Nach der Anmeldung merkt sich das Gerät bis zu 72 Poster-Adressen (`localStorage`) und zeigt die Poster hinter dem Anmeldeformular. „Server wechseln“ löscht die Liste. Wer das Gerät benutzt, sieht diese Poster also auch abgemeldet.

## Bewusst nicht enthalten

- Offline-Downloads, Chromecast und AirPlay
- Eingebettete YouTube-Trailer: Remote-Trailer öffnen sich als Link in einem neuen Tab
- Marketing-Startseite: Die App beginnt mit der Serverauswahl
- Mehrsprachigkeit: Die Oberfläche ist deutsch, Titel und Beschreibungen kommen in der Metadatensprache des Servers

## Markenrechte

Das Projekt enthält keine Logos, Schriften, Grafiken oder Texte von Streaming-Anbietern. Schriftzug, Profilkacheln und Symbole sind eigene Umsetzungen. Vor einer öffentlichen Bereitstellung sollte das Erscheinungsbild, vor allem die Akzentfarbe `--red` in `src/styles/app.css`, wegen möglicher Verwechslungsgefahr geprüft werden.
