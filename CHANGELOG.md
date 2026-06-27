# Changelog
Alle zukünftigen Änderungen an der Windows-Bar werden in dieser Datei dokumentiert.

## [1.1.3] - 2026-06-28

**🧰 Aufräum-, Stabilitäts- & Feature-Update — schneller, robuster, hübscher**

### 🎨 Neuer `/help` & passende Icons
* **`/help` (bzw. `/`) komplett überarbeitet:** Befehle werden jetzt in sauberen Reihen mit **Icon, Befehl und Beschreibung** angezeigt, gruppiert nach Kategorie mit eigenem Kategorie-Icon.
* **Jeder Befehl hat ein passendes Icon** statt eines generischen Platzhalters — `/calc` ein Taschenrechner, `/lock` ein Schloss, `/speedtest` ein Tacho, `/ports` ein Netzwerk-Symbol, `/volume` ein Lautsprecher, `/kill` ein Totenkopf usw. (vorher zeigten z.B. alle System-Befehle dasselbe — teils falsche — Symbol).

### 🔌 Neues Plugin: Timer & Pomodoro
* **`/timer 25m Deep Work`** — Countdown mit Windows-Benachrichtigung bei Ablauf. `/timer` ohne Argument listet laufende Timer (Enter bricht ab).
* **`/pomodoro`** — zyklischer Fokus-Timer (Arbeit → Pause → Arbeit), Längen einstellbar.
* **`/timers-clear`** — alle abbrechen. Übersteht App-Neustart (laufende Timer werden wiederhergestellt). Komplett offline.

### ✨ Neue Befehle
* **`/uptime`** (`/boot`) — Systemlaufzeit & letzter Start.
* **`/ports`** (`/netstat`) — lauschende TCP-Ports samt zugehörigem Prozess (`/ports 3000`, `/ports node`).
* **`/case`** — Text in alle Schreibweisen (camelCase, snake_case, kebab-case, CONSTANT_CASE …), jede kopierbar.
* **`/roll`** — Würfeln (`/roll 2d6`, `/roll d20`, `/roll 4d8+2`).

### ⚡ Performance
* **Deutlich schnellerer Kaltstart:** Der Datei-Index wird gespeichert und beim Start sofort geladen — die erste Suche ist instant, statt auf den vollständigen Laufwerks-Scan zu warten.
* **Flüssigere Suche:** Die „Läuft Everything?"-Prüfung wird nicht mehr bei jedem Tastendruck ausgeführt (blockierte den Hauptprozess), sondern kurz zwischengespeichert.
* **Schnellerer erster Aufbau:** schwere Ansichten (Einstellungen, KI, Notizen, Player) werden erst bei Bedarf geladen; der Update-Check startet kurz verzögert, statt mit der ersten Suche zu konkurrieren.

### 🐛 Behobene Fehler
* **Standard-Electron-Fenster beim PC-Start behoben** — der Autostart-Eintrag zeigte (durch den Entwickler-Modus) auf ein leeres Electron statt auf die App.
* **Scroll-Problem behoben:** In Einstellungen, Notizen und langen Suchergebnis-Listen ließ sich nicht bis nach ganz unten scrollen — die Panels ragten unsichtbar aus dem Fenster.
* **KI-Schlüssel gingen beim Neustart verloren** — gespeicherte API-Keys wurden beim Lesen beschädigt; bleiben jetzt erhalten.
* **KI-Antworten verloren gelegentlich Wörter** beim Streaming (über zwei Datenpakete getrennte Teile) — behoben.
* **Möglicher Weißbild-Absturz** bei beschädigten/älteren Einstellungen oder einem fehlerhaften Index-Cache abgefangen; eine fehlgeschlagene Ansicht zeigt jetzt einen „Neu laden"-Hinweis statt eines weißen Fensters.
* `/kill chrome.exe` traf nichts mehr (wurde zu `chrome.exe.exe`) — korrigiert.
* Diverse kleinere Lecks, Race-Conditions und Datei-Index-Ungenauigkeiten (veraltete/gelöschte Einträge) bereinigt.

### 🧹 Unter der Haube
* Toter Code, ungenutzte Abhängigkeiten und ein versteckter, kaputter „Terminal"-Pfad entfernt; Architektur-Dokumentation (`AGENTS.md`) für beide Projekte ergänzt.

## [1.1.1] - 2026-06-25

**🎵 Media-Player-Plugin-Unterstützung & YouTube Music**

### 🎵 Eingebetteter Media-Player
* **Neue generische Plugin-Fähigkeit:** Plugins können jetzt einen eingebetteten Web-Player bereitstellen (Manifest-Feld `mediaPanel`). Die App rendert dafür eine echte Chromium-Ansicht, die im Hintergrund weiterspielt — so können beliebige Musik-/Media-Plugins gebaut werden.
* **Now-Playing-Leiste unter der Suche** (volle Breite, auch im Kompaktmodus) mit Cover, Cover-Glow, Like/Dislike, Vor/Zurück/Play-Pause, **klickbarem Fortschrittsbalken**, Lautstärke (Hover-Aufklapper) und Restzeit.
* **YouTube Music** läuft als eigenständiges Plugin: Login direkt im eingebetteten Player (Google-Sign-in funktioniert), Hintergrund-Wiedergabe und ein **lokaler API-Server** (`http://127.0.0.1:26538/api/v1/song`, kompatibel zu gängigen Stream-Overlays) inkl. Steuer-Endpunkten.

### 🐛 Fixes & Robustheit
* **Plugin-Bridge repariert:** `invokeMainAction` war durch einen Namens-Tippfehler nie erreichbar — Media-Plugins können den Player jetzt tatsächlich ansteuern.
* **Plugin-Installation repariert:** Der „Plugin installieren"-Dialog übergab nur den Ordnernamen (funktionierte nie) → jetzt nativer Ordner-Dialog.
* **Now-Playing stabilisiert:** Auslesen über die offizielle YouTube-Player-API (korrekte Zeit pro Song), Cover-Fallback und Halten des letzten gültigen Zustands bei Songwechseln → kein Flackern mehr.
* Plugin-Einstellungen wirken jetzt **live** (die App wird über Änderungen benachrichtigt).

### 🪟 Verhalten
* Die Bar startet versteckt und erscheint nur per Hotkey; im Entwickler-Modus startet sie sichtbar.

## [1.1.0] - 2026-06-24

**✨ Großes Overhaul-Update: Fixes, neue Werkzeuge, Design & Anpassbarkeit**

### 🛠️ Reparierte Funktionen (vorher kaputt)
* **`/lock`, `/shutdown`, `/restart` + neu `/logoff`:** Nutzten ein totes `cmd://`-Protokoll und taten gar nichts. Laufen jetzt über echte Windows-Befehle.
* **`/run`:** Erzeugte einen ungültigen Datei-Pfad und brach ab. Startet Programme jetzt zuverlässig (z.B. `/run notepad`).
* **Bildschirm ausschalten (`/sleep`):** Falscher Tastentrick → ersetzt durch den korrekten `SC_MONITORPOWER`-Befehl. Schaltet den Monitor jetzt wirklich aus.
* **Stummschalten (`/mute`) & Lautstärke (neu `/volume 0–100`):** Sendeten nur zufällige Zeichen. Nutzen jetzt die echte Windows-Audio-API (WASAPI).
* **Zwischenablage-Verlauf:** `/history` zeigte nur, was per `/cp` kopiert wurde. Es gibt jetzt einen echten Zwischenablage-Monitor (Text **und** Bilder) mit Zeitstempeln.
* **System-Info (`/sys`):** Disk-Anzeige nutzte das auf Windows 11 entfernte `wmic`. Läuft jetzt über die native Node-API (kein Einfrieren mehr).
* **Suche:** Findet jetzt auch über Anfangsbuchstaben (Fuzzy), z.B. `vsc` → „Visual Studio Code".

### 🚀 Neue Werkzeuge & Befehle
* **Netzwerk:** `/ip` (öffentliche **+** lokale IP), `/speedtest` (Download & Ping live), `/ping <host>`, `/dns <host>`, `/wifi` (WLAN-Status & gespeicherte Netze).
* **Akku:** `/battery` zeigt Ladestand & Ladezustand.
* **Umrechnen:** `/units 10 km mi` (Länge, Gewicht, Temperatur, Geschwindigkeit, Daten) und `/currency 100 usd eur` (Live-Wechselkurse).
* **Emoji-Suche:** `/emoji feuer` — durchsuchbarer Emoji-Picker, kein Internet nötig.
* **Farb-Werkzeug:** `/color #ff6600` zeigt jetzt eine Farbvorschau (Swatch) + HEX/RGB/HSL zum Kopieren.
* **Mehr Hashes:** `/md5`, `/sha1`, `/sha512` (zusätzlich zum bestehenden `/hash` = SHA-256). Base64 (`/enc`, `/dec`) ist jetzt UTF-8-/Umlaut-sicher.

### 🎵 Media-Player & Plugins
* **Player-Leiste unter der Suche** (volle Breite, mit Fortschrittsanzeige) — bleibt auch im **Kompaktmodus** sichtbar; mit großer Player-Ansicht (Seek, Lautstärke).
* **Plugin-Bridge repariert:** `invokeMainAction` war durch einen Namens-Tippfehler nie erreichbar — Media-Plugins (z.B. das separate **YouTube-Music-Plugin**) können den Player jetzt tatsächlich ansteuern.
* Das YouTube-Music-Plugin selbst (Login, Hintergrund-Wiedergabe, API-Server) ist ein **eigenständiges Plugin** und nicht Teil der App.

### 🪟 Verhalten beim Start
* Die Bar **startet jetzt versteckt** und erscheint nur per Hotkey (Alt+Space) — kein lästiges Wegklicken mehr nach dem PC-Start. (Im Entwickler-Modus startet sie sichtbar, damit sie trotz belegtem Hotkey testbar ist.)

### 🎨 Design
* Neues **Design-Token-System** (einheitliche Abstände, Typografie, Radien, Animationen) für ein durchgängig stimmiges, hochwertiges Bild.
* Fokus-Rahmen für Tastatur-Navigation hinzugefügt — das große Suchfeld ist davon ausgenommen (kein Rahmen ums Eingabefeld).
* Neues auffälliges **Signature-Theme „Aurora ✦"** (tiefes Violett mit Magenta-Glow).
* **Light-Mode überarbeitet** — kräftigere Kontraste, weniger blass.
* Einheitliche Hover-/Fokus-/Deaktiviert-Zustände, sauberere Buttons & Icons, `prefers-reduced-motion` wird respektiert.

### ⚙️ Anpassbarkeit
* **Anpassbarer globaler Hotkey** statt fest Alt+Space — frei belegbar im neuen Tab „Tastenkürzel".
* **Theme-Builder:** eigene Themes mit Farbwählern & Live-Vorschau erstellen, exportieren und löschen.
* **System folgen (Hell/Dunkel):** Theme passt sich automatisch an die Windows-Einstellung an.
* **Fensterbreite** ist jetzt einstellbar; **Einstellungs-Suche** im Seitenmenü.

### 🔒 Sicherheit & Stabilität
* **KI-API-Schlüssel** werden jetzt verschlüsselt im OS-Schlüsselbund (safeStorage) gespeichert statt im Klartext.
* **Command-Injection-Lücke** beim Kopieren in die Zwischenablage geschlossen (native Electron-API statt PowerShell).
* **Plugin-Sicherheit:** Plugin-IDs werden gegen Path-Traversal validiert.
* **Auto-Updater entschärft:** doppelter Download-Pfad deaktiviert; `release.js` macht keinen gefährlichen `git push --force` mehr auf Tags.
* Aktualisierte KI-Modell-ID (`claude-opus-4-8`); vorbestehende TypeScript-Fehler im Projekt bereinigt.

## [1.0.15] - 2026-04-09

**🚀 Auto-Update Fixes & Auto-Restart**

* **Auto-Restart nach Update:** Ein Klick auf "Jetzt installieren" schließt die App, entpackt das Update lautlos im Hintergrund und startet die App danach vollautomatisch wieder neu.
* **Download & Install Logik:** Ein Fehler wurde behoben, bei dem der Installations-Button eingefroren ist, wenn er während eines laufenden Downloads geklickt wurde. Die App merkt sich nun die Anweisung und startet die Installation sofort, wenn der Download 100% erreicht.
* **Robusterer Download:** Der Download nutzt jetzt direkt das native Node.js-Modul (statt Chromium), wodurch Abbrüche bei Hintergrund-Aktivitäten verhindert werden.

## [1.0.14] - 2026-04-08

**🐛 Hotfix: UI-Freeze beim Update-Check**

* Es wurde ein Fehler behoben, durch den die App beim Suchen nach Updates scheinbar im Ladezustand ("Prüfe...") stecken geblieben ist. Der Auto-Updater wartet nun nicht mehr im Hintergrund ab, bis der gesamte Download beendet ist, bevor er das Frontend informiert. Stattdessen wird die Update-Suche sofort abgeschlossen und der Download läuft anschließend nahtlos im Hintergrund weiter!

## [1.0.13] - 2026-04-08

**🚀 Auto-Update Verbesserungen**

* **Unsichtbare Updates:** Updates laden ab sofort absolut zuverlässig und performant im Hintergrund herunter, selbst wenn die Suchleiste nach Ausführen des Befehls geschlossen wird (Background Throttling für Chromium deaktiviert).
* **Bessere Status-Erkennung:** Wenn du die Einstellungen wieder öffnest, wird nun korrekt der aktive Download-Fortschritt in % angezeigt, anstatt fälschlicherweise auf "Wird vorbereitet..." hängen zu bleiben.
* **Update Badge:** Ein neuer kleiner roter (oder blauer/accentfarbener) Indikator-Punkt am Einstellungs-Zahnrad in der Suchleiste zeigt sofort an, wenn ein Update erfolgreich im Hintergrund heruntergeladen wurde und zur Installation bereitsteht.
* **Neustart-Routine:** Ein Klick auf "Installieren" in den Einstellungen leitet nun verlässlich das Schließen der App und den automatischen Neustart nach dem NSIS-Entpackvorgang ein.
* **Daten-Sicherheit:** Durch saubere Isolierung des NSIS Updaters bleiben alle lokalen Einstellungen, Session-Historien, Notizen und Plugin-Daten auch nach Updates vollständig erhalten.

## [1.0.11] - 2026-04-07

**🧹 Bereinigung & Wartung**

* Code bereinigt: Unbenutzte Variablen und leere Catch-Blöcke entfernt
* Lint-Fehler in main.ts, everything.ts und windowsSearch.ts behoben
* Projekt bereinigt: `.opencode`, `Bug Screenshot`, `dev_logs.txt`, `tmp.json`, `tmp3.json` entfernt
* TypeScript-Typfehler behoben

**📦 Build-Optimierung**

* `plugins/` Ordner wird jetzt korrekt in die EXE bundled
* Optimierte Build-Konfiguration

## [1.0.10] - 2026-04-07

**✨ Neue Features & Highlights**

* **Media Control Plugin:** Systemweite Mediensteuerung für Spotify, VLC, Windows Media Player und andere Player. Unterstützt folgende Befehle:
  - `/pause` - Wiedergabe pausieren
  - `/play` - Wiedergabe fortsetzen
  - `/next` - Nächster Titel
  - `/prev` - Vorheriger Titel
  - `/now` - Aktuellen Status anzeigen

* **Media Control View:** Neue View für erweiterte Mediensteuerung mit Play/Pause, Previous/Next Buttons und Volume-Slider.

* **Compact Player:** Der kompakte Player unter der Suchleiste zeigt jetzt aktive Medienwiedergabe an und ermöglicht Steuerung direkt aus der Suchleiste.

**🔄 Refactoring**

* **YouTube Music → Media Control:** Das YouTube Music Plugin wurde durch ein generisches Media Control Plugin ersetzt, das mit allen Media-Playern auf Windows funktioniert (Spotify, VLC, Windows Media Player, Groove Music, etc.).

* **View-Umbenennung:** `youtube-music` View wurde in `media-control` umbenannt.

* **Plugin-System Verbesserungen:** Erweiterte Debug-Logging für Plugin-Laden und Action-Registrierung.

**🧹 Bereinigung**

* Entfernt: `.opencode` Ordner
* Entfernt: `Bug Screenshot` Ordner
* Entfernt: `dev_logs.txt`, `eslint_out.json`, `tmp.json`, `tmp3.json`
* Entfernt: Altes YouTube Music Plugin (`plugins/youtube-music/`)
* Entfernt: `YouTubeMusicView.tsx`

**🐛 Bugfixes**

* Media-Control Commands funktionieren jetzt mit korrekter Error-Handhabung.
* Plugin-Action-Registrierung zeigt jetzt Debug-Logs in der Console.

## [1.0.9] - 2026-04-07

**✨ Neue Features & Highlights**

* **Komplett neuer Notizen-View:** Die Notizen-Ansicht wurde von Grund auf neu gestaltet mit modernem Zwei-Panel-Layout, integrierter Suchfunktion zum Filtern von Notizen, relativen Zeitstempeln ("Vor 5 Min."), Zeichen-/Zeilenzähler und Kopieren-Button.

* **Globale Escape-Shortcuts:** Escape funktioniert jetzt von jeder Ansicht aus (Notizen, Einstellungen, KI-Chat) um direkt zurück zur Suche zu gelangen – komplett ohne Maus.

* **Dynamische Versionsanzeige:** Die Versionsnummer in der Über-Sektion wird jetzt automatisch aus der App ausgelesen und ist nicht mehr hardcodiert.

**🐛 Bugfixes**

* **Notizen-Erstellen-Fix:** Der "Neue Notiz erstellen" Button funktionierte nicht mehr und wurde repariert.

* **Notizen-Bearbeitungs-Fix:** Ausgewählte Notizen konnten nicht bearbeitet werden, da die Textarea fälschlicherweise im ReadOnly-Modus war.

* **App-Start Reset:** Nach dem Verstecken der App (Alt+Space) und erneutem Öffnen wurde die zuletzt aktive Ansicht angezeigt. Die App startet jetzt immer zuverlässig mit der Suchleiste.

## [1.0.8] - 2026-04-08

**✨ Neue Features & Highlights**

* **Fuzzy Search:** Die Suchfunktion wurde durch Fuzzy Search verbessert, sodass nun auch ungenaue Suchanfragen zu besseren Ergebnissen führen.

* **Click History:** Die Suchfunktion wurde durch Click History verbessert, sodass nun auch ungenaue Suchanfragen zu besseren Ergebnissen führen.

## [1.0.7] - 2026-04-08

Dieses Update bringt ein komplett neues System für die Release-Notes und behebt Layout-Fehler in den Einstellungen.

**✨ Neue Features & Highlights**

* **Dynamischer Changelog:** Die In-App Release-Notes werden jetzt vollautomatisch im Hintergrund generiert. Nie wieder hartcodierte Texte!

* **Release-Skript Upgrade:** Das interne Skript für automatische Updates liest Dateien nun extrem fehlertolerant und filtert unsichtbare Windows-Zeichen (BOM) automatisch heraus.

**🎨 UI/UX Verbesserungen**

* **Scroll-Fix in Einstellungen:** Der Changelog-Tab ist unten nicht mehr abgeschnitten, sodass nun bequem bis zur allerersten Version gescrollt werden kann.

* **Listen-Design:** Die Aufzählungspunkte im Changelog nutzen nun ein sauberes Flexbox-Layout und erstrahlen dynamisch in deiner aktuellen Akzentfarbe.

**🐛 Bugfixes**

* **Code-Bereinigung:** Ungenutzte Imports und störende TypeScript-Warnungen in der Settings-Ansicht wurden vollständig entfernt.

## [1.0.6] - 2026-04-07

Dieses Update konzentriert sich auf eine massive Verbesserung der Performance und die Beseitigung technischer Altlasten.

**⚡ Performance & Stabilität**

* **Asynchrones Dateisystem:** Das Auslesen von .url- und .lnk-Dateien sowie das Laden von Ordnerinhalten erfolgt nun vollständig asynchron. Das verhindert "Micro-Stuttering" und UI-Freezes während der Suche.
* **Smart Debouncing:** Jeder überwachte Systemordner (Desktop, Downloads etc.) hat nun seinen eigenen Timer. Dateiänderungen werden dadurch präziser erkannt und die CPU weniger belastet.
* **Memory Management:** Ein neues Schutzsystem in der Suchansicht bricht veraltete Suchanfragen sofort ab, was den Speicherverbrauch senkt und die Reaktionszeit beim Tippen verbessert.

**🐛 Bugfixes**

* **Icon-Fix:** Ein Fehler wurde behoben, bei dem Datei-Icons nach schnellen Suchanfragen nicht mehr korrekt angezeigt wurden.
* **TypeScript-Bereinigung:** Kritische Typisierungsfehler in der SearchView.tsx wurden behoben.
* **Code-Cleanup:** Über 200 Zeilen redundanter Code und ungenutzte Variablen in der main.ts wurden entfernt, um die App schlanker und wartungsfreundlicher zu machen.
* **Wetter-Stabilität:** Die Fehlerbehandlung bei Verbindungsabbrüchen zur Wetter-API wurde verbessert.

## [1.0.5] - 2026-04-06

Dieses Update bringt wichtige Stabilitätsverbesserungen für das automatische Update-System.

**🐛 Bugfixes**
* **Auto-Updater Fix:** Behebt einen Fehler (404 Not Found für `latest.yml`), durch den die App neue Updates nicht korrekt erkennen und herunterladen konnte.
* **Build-Prozess:** Der interne Build-Prozess wurde optimiert, um Metadaten-Dateien für Releases nun immer zuverlässig zu generieren.

### 🔄 Auto-Update
Nutzer der Version 1.0.4 können sich dieses Update manuell herunterladen. Zukünftige Versionen (ab 1.0.5) werden sich dann komplett automatisch und still im Hintergrund aktualisieren!

## [1.0.4] - 2026-04-01

Dies ist ein großes Feature-Release für die Premium Search Bar.

**✨ Neue Features & Highlights**
* **Unified Search:** Blitzschnelle, übergreifende Suche durch lokale Dateien, Programme, Startmenü und Steam/Epic/Riot Games.
* **Erweitertes Plugin-System:** Unterstützung für erweiterbare Plugins zur individuellen Anpassung der Bar.
* **Instant Answers:** Schnelle Antworten für Mathe-Aufgaben, Wetter und Web-Suchen direkt in den Suchergebnissen.

**⚙️ System & Unterbau**
* Implementierung des automatischen Silent-Updaters im Hintergrund.
* Caching-System für Programm- und Datei-Icons für wesentlich schnellere Ladezeiten.

## [1.0.3] - 2026-03-15

Dieses Update erweitert die KI-Fähigkeiten und bringt neue Systembefehle.

**✨ Neue Features**
* **Mehr KI-Modelle:** Neben OpenAI werden nun auch Anthropic (Claude 3.5 Sonnet/Opus) und Google Gemini (2.0 Pro/Flash) direkt im Chat unterstützt.
* **Sichere API-Keys:** API-Schlüssel für die KI-Modelle werden nun sicher und verschlüsselt im Betriebssystem gespeichert (Electron safeStorage).
* **System-Befehle:** Direkte Steuerung des PCs über die Suchleiste hinzugefügt. Unterstützt nun Befehle wie Volume Control, Sleep, Mute, und das Leeren des Papierkorbs.

## [1.0.2] - 2026-02-28

Fokus auf Suchgeschwindigkeit und tiefere Windows-Integration.

**🚀 Performance**
* **Everything-Integration:** Die Suche nutzt nun optional den "Everything"-Indexer für eine sofortige und systemweite Dateisuche ohne Ladezeiten.
* **Fallback-Suche:** Intelligenter Fallback auf den regulären Windows Search Indexer, falls "Everything" nicht installiert oder gestartet ist.

**🐛 Bugfixes**
* Verbesserte Erkennung von versteckten Dateien und Systemordnern.

## [1.0.1] - 2026-02-10

Erstes Update mit Fokus auf Design und Benutzerfreundlichkeit.

**🎨 UI/UX Verbesserungen**
* Transparenz- und Blur-Effekte (Mica/Acrylic) für ein nativeres Windows 11 Gefühl verfeinert.
* Tastenkürzel (Alt+Space) zum schnellen Öffnen/Schließen zuverlässiger gemacht.
* Overlay-Modus hinzugefügt: Die Bar kann nun auch über Vollbild-Anwendungen und Spielen angezeigt werden.

## [1.0.0] - 2026-01-20

**🎉 Initial Release**
* Grundlegende Veröffentlichung der Windows-Bar.
* Lokale Dateisuche und Programmstarter implementiert.
* Erster Entwurf des integrierten KI-Chats (OpenAI).
* Basis-Einstellungen für Autostart und Always-on-Top.