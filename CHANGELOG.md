# Changelog
Alle zukünftigen Änderungen an der Windows-Bar werden in dieser Datei dokumentiert.

## [1.1.1] - 2026-04-07

**🧹 Bereinigung & Wartung**

* Code bereinigt: Unbenutzte Variablen und leere Catch-Blöcke entfernt
* Lint-Fehler in main.ts, everything.ts und windowsSearch.ts behoben
* Projekt bereinigt: `.opencode`, `Bug Screenshot`, `dev_logs.txt`, `tmp.json`, `tmp3.json` entfernt
* TypeScript-Typfehler behoben

**📦 Build-Optimierung**

* `plugins/` Ordner wird jetzt korrekt in die EXE bundled
* Optimierte Build-Konfiguration

## [1.1.0] - 2026-04-07

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