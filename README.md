# Windows Bar 🚀

Eine schnelle, elegante Suchleiste für Windows im Stil von macOS Spotlight und Raycast.

## ✨ NEU in v2.0: 32+ Quick Commands!

Tippe `>` gefolgt von einem Befehl direkt in die Suchleiste:

### 📊 Rechner & Zahlen
| Befehl | Beschreibung |
|--------|-------------|
| `>calc 123*45` | Taschenrechner |
| `>random 1-100` | Zufallszahl |
| `>uuid` | UUID generieren |
| `>binary Text` | Text zu Binär |
| `>hex Text` | Text zu Hexadezimal |

### 🔐 Sicherheit & Hashes
| Befehl | Beschreibung |
|--------|-------------|
| `>pass 16` | Sicheres Passwort |
| `>hash Text` | SHA-256 Hash |
| `>key 32` | API-Key generieren |

### 📝 Text-Tools
| Befehl | Beschreibung |
|--------|-------------|
| `>enc/dec Text` | Base64 kodieren/dekodieren |
| `>url/unurl Text` | URL kodieren/dekodieren |
| `>json {"a":1}` | JSON formatieren |
| `>len/count/rev/upper/lower/trim` | Text-Operationen |
| `>sort/unique/replace` | Listen-Operationen |

### 🌐 Web & Netzwerk
| Befehl | Beschreibung |
|--------|-------------|
| `>ip` | Öffentliche IP-Adresse |
| `>shorten URL` | URL kürzen |
| `>qr Text` | QR-Code generieren |
| `>weather Stadt` | Wetter anzeigen |
| `>wiki Thema` | Wikipedia |
| `>tr en:de Text` | Übersetzen |

### ⏰ Datum & Zeit
| Befehl | Beschreibung |
|--------|-------------|
| `>now` | Aktuelle Zeit |
| `>age 1990-05-15` | Alter berechnen |
| `>days 2024-12-31` | Tage bis Datum |
| `>week` | Kalenderwoche |

### 💾 Zwischenablage & Notizen
| Befehl | Beschreibung |
|--------|-------------|
| `>cp` | Zwischenablage anzeigen |
| `>cp Text` | In Zwischenablage kopieren |
| `>history` | Zwischenablage-Verlauf |
| `>note/notes/clear-notes` | Schnelle Notizen |

### 🖥️ System-Befehle
| Befehl | Beschreibung |
|--------|-------------|
| `>sys` | Systeminfos (CPU, RAM, Disk) |
| `>proc` | Laufende Prozesse |
| `>kill Name` | Prozess beenden |
| `>run notepad` | Programm starten |
| `>sleep` | Bildschirm ausschalten |
| `>mute` | Stummschalten |
| `>trash` | Papierkorb leeren |
| `>ss` | Screenshot |
| `>lock/shutdown/restart` | PC steuern |


![Windows Bar](resources/icon.png)

## Funktionen

### 🔍 Universelle Suche
- **Lokale Dateisuche**: Durchsucht Apps, Dateien, Ordner und Dokumente blitzschnell
- **Smart Indexing**: Automatische Indexierung von Startmenü, Program Files, Benutzerordnern und allen Laufwerken
- **Game-Erkennung**: Erkennt automatisch installierte Spiele von Steam, Epic Games und Riot Games

### 🌐 Web-Suche (`/g`)
- **Inline-Ergebnisse**: Zeigt Web-Ergebnisse direkt in der Suchleiste
- **DuckDuckGo Integration**: Liefert Wikipedia-Zusammenfassungen und Instant Answers
- **Google Auto-Complete**: Zeigt Suchvorschläge während der Eingabe

### 🤖 KI-Chat (`/ai`)
- **Google Gemini CLI**: Integrierte Terminal-Oberfläche für Google Gemini
- **Nativer Terminal-Zugriff**: Direkter Zugriff auf cmd.exe für KI-Interaktionen

### ⛅ Wetter
- **Sofortige Wetteranzeige**: Gib "Wetter" oder "Wetter [Stadt]" ein
- **Kompakte Anzeige**: Temperatur, Wetterbedingung und Windstärke auf einen Blick

### 🧮 Taschenrechner
- **Mathematische Ausdrücke**: Gib mathematische Ausdrücke ein (z.B. `123 + 456 * 2`)
- **Sofortiges Ergebnis**: Ergebnisse werden direkt angezeigt

### 📁 Ordner-Vorschau
- **Tab-Expansion**: Drücke `Tab` auf einem Ordner, um den Inhalt anzuzeigen
- **Schnellnavigation**: Durchsuche Unterordner ohne den Datei-Explorer zu öffnen

### 🕐 Verlauf
- **Zuletzt gesucht**: Die letzten 5 Suchergebnisse werden gespeichert
- **Schnellzugriff**: Häufig genutzte Apps und Dateien sind sofort verfügbar

### ⚡ Quick Actions
Schnellzugriff-Buttons für häufige Aktionen:
- **KI Chat**: Gemini direkt öffnen
- **Web Suche**: Inline Web-Suche starten
- **Dateien**: Schnellzugriff auf Benutzerordner
- **Wetter**: Aktuelles Wetter anzeigen

### 🛠️ System-Tools
Windows Bar bietet direkten Zugriff auf wichtige System-Tools:
- **Einstellungen** (`ms-settings:`) - Windows Einstellungen
- **Systemsteuerung** (`control`) - Klassische Systemsteuerung
- **Registrierungs-Editor** (`regedit`) - Windows Registry
- **Task-Manager** (`taskmgr`) - Prozessverwaltung
- **Datei-Explorer** (`explorer`) - Windows Explorer
- **Rechner** (`calc`) - Windows Taschenrechner
- **Editor** (`notepad`) - Notepad
- **Eingabeaufforderung** (`cmd`) - Command Prompt
- **PowerShell** (`powershell`) - PowerShell
- **Geräte-Manager** (`devmgmt.msc`) - Gerätemanager

### 🎮 Gaming-Integration
Automatische Erkennung von Spielen aus:
- **Steam**: Liest `libraryfolders.vdf` für alle Bibliotheken
- **Epic Games**: Durchsucht Epic Games Installationsordner
- **Riot Games**: Erkennt League of Legends, Valorant, etc.
- **Direkter Start**: Spiele werden via `steam://rungameid/` gestartet

### 🔎 Smarte Suchlogik
- **Exakter Treffer**: Höchste Priorität bei exaktem Namensmatch
- **Benutzerordner-Priorität**: Downloads, Desktop, Dokumente werden bevorzugt
- **Typ-Priorisierung**: Ordner > Spiele > Apps > System
- **Verschachtelungs-Strafe**: Flache Pfade werden bevorzugt
- **Fuzzy-Suche**: Teilbegriffe werden gefunden

---

## Installation

### Voraussetzungen
- Windows 10 oder Windows 11
- Node.js 18+ und npm

### Entwicklung

```bash
# Repository klonen
git clone https://github.com/JackyWein/Windows-Bar.git
cd Windows-Bar

# Abhängigkeiten installieren
npm install

# Entwicklung starten
npm run dev
```

### Build

```bash
# Produktions-Build erstellen
npm run build

# Electron-App starten
npm run electron
```

---

## Bedienung

### Tastenkürzel

| Taste | Funktion |
|-------|----------|
| `Alt + Space` | Windows Bar öffnen/schließen |
| `↑` / `↓` | Durch Ergebnisse navigieren |
| `Enter` | Ausgewähltes Element öffnen |
| `Tab` | Ordnerinhalt anzeigen / Web-Vorschläge einblenden |
| `Escape` | Schließen |

### Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `/ai` | Google Gemini KI-Chat öffnen |
| `/g [Suchbegriff]` | Web-Suche mit Inline-Ergebnissen |
| `Wetter` oder `Wetter [Stadt]` | Aktuelles Wetter anzeigen |
| Mathematischer Ausdruck (z.B. `5+5`) | Ergebnis berechnen |

### Suchtipps

1. **Apps finden**: Gib den App-Namen ein (z.B. "Chrome", "Photoshop")
2. **Dateien finden**: Gib den Dateinamen oder -typ ein (z.B. "pdf", "bild")
3. **Spiele finden**: Spiele werden automatisch erkannt und als "Spiel" markiert
4. **System-Tools**: Gib "Einstellungen", "Task-Manager" oder "PowerShell" ein

---

## Einstellungen

### Autostart
Windows Bar registriert sich automatisch beim ersten Start als Autostart-Programm.

### Google Gemini CLI einrichten

1. Installiere die Gemini CLI:
   ```bash
   npm install -g @anthropic-ai/gemini-cli
   ```
   Oder folge der offiziellen [Gemini CLI Dokumentation](https://github.com/google-gemini/gemini-cli)

2. Authentifiziere dich:
   ```bash
   gemini auth login
   ```

3. Starte Windows Bar neu und gib `/ai` ein

### Indizierte Ordner
Windows Bar durchsucht automatisch:
- Startmenü (Programme)
- Program Files & Program Files (x86)
- Benutzerordner (Desktop, Downloads, Dokumente, Bilder, Videos, Musik)
- Steam-Bibliotheken
- Epic Games
- Riot Games
- Alle verfügbaren Laufwerke (C:, D:, E:, F:, G:, H:)

### Ausgeschlossene Ordner
Folgende Ordner werden von der Indexierung ausgeschlossen:
- `node_modules`, `.git`, `__pycache__`
- `$recycle.bin`, `$windows.~bt`, `$windows.~ws`
- `Windows`, `System Volume Information`, `Recovery`
- `ProgramData`, `AppData`

---

## Design & Customizing

### CSS-Variablen anpassen
Das Erscheinungsbild kann über CSS-Variablen in `src/index.css` angepasst werden:

```css
:root {
  --bg: rgba(15, 15, 20, 0.85);        /* Hintergrundfarbe */
  --border: rgba(255, 255, 255, 0.08); /* Rahmenfarbe */
  --text: #f0f0f5;                     /* Textfarbe */
  --text-muted: #6b6b80;               /* Gedämpfter Text */
  --text-dim: #4a4a5a;                 /* Schwacher Text */
  --accent: #7c5cfc;                   /* Akzentfarbe (Lila) */
  --item-hover: rgba(255, 255, 255, 0.04);  /* Hover-Effekt */
  --item-selected: rgba(124, 92, 252, 0.08); /* Auswahl-Effekt */
  --green: #4ade80;                    /* Spiele-Farbe */
  --blue: #60a5fa;                     /* Dateien-Farbe */
  --orange: #fb923c;                   /* Web/Folder-Farbe */
  --pink: #f472b6;                     /* KI-Farbe */
  --radius: 14px;                      /* Abrundung */
}
```

### Typspezifische Icon-Farben
Jeder Ergebnistyp hat eine eigene Farbe:
- **Apps**: Lila (`--accent`)
- **Dateien**: Blau (`--blue`)
- **Spiele**: Grün (`--green`)
- **Web**: Orange (`--orange`)
- **KI**: Pink (`--pink`)
- **System**: Grau
- **Ordner**: Orange

### Dateityp-spezifische Icons
Windows Bar zeigt verschiedene Icons basierend auf dem Dateityp:
- 🎵 **Audio**: mp3, wav, flac, aac, ogg, m4a, wma
- 🎬 **Video**: mp4, mkv, avi, mov, wmv, flv, webm
- 🖼️ **Bilder**: jpg, jpeg, png, gif, bmp, webp, svg, ico
- 📦 **Archive**: zip, rar, 7z, tar, gz, bz2
- 💻 **Code**: js, ts, jsx, tsx, py, java, cpp, c, cs, go, rs, rb, php, html, css, json, xml
- 📄 **Dokumente**: pdf, doc, docx, txt, rtf, odt
- 📊 **Tabellen**: xls, xlsx, csv, ods
- 📽️ **Präsentationen**: ppt, pptx, odp
- 💾 **Laufwerke**: C:\, D:\, etc.

### Glaseffekt-UI
- **Blur-Effekt**: 40px Backdrop-Blur mit Sättigung
- **Transparenz**: Halbtransparenter Hintergrund
- **Animation**: Sanfte Einblend-Animation beim Öffnen

---

## Technologie

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Electron 41
- **Terminal**: xterm.js mit FitAddon
- **Animationen**: Framer Motion
- **Icons**: Lucide React
- **Web-APIs**: DuckDuckGo Instant Answer, wttr.in (Wetter), Google Suggest

---

## Projektstruktur

```
Windows-Bar/
├── electron/
│   ├── main.ts          # Electron Main Process
│   ├── preload.ts       # Preload Script für IPC
│   └── preload.cjs      # CommonJS Preload
├── src/
│   ├── App.tsx          # Hauptkomponente
│   ├── main.tsx         # React Entry Point
│   ├── index.css        # Globale Styles
│   └── components/      # React Komponenten
├── resources/
│   └── icon.png         # App-Icon
├── dist-electron/       # Kompilierte Electron-Dateien
└── dist/                # Kompilierte Web-Dateien
```

---

## Mitwirken

Beiträge sind willkommen! Bitte erstelle einen Pull Request oder eröffne ein Issue.

## Lizenz

MIT License - Siehe [LICENSE](LICENSE) für Details.

---

## Bekannte Probleme

- Icons werden für einige Dateitypen möglicherweise nicht korrekt angezeigt (Fallback-Icons werden verwendet)
- Gemini CLI muss separat installiert werden

## Roadmap

- [ ] Einstellungs-UI für Indizierungsoptionen
- [ ] Weitere KI-Provider (Claude, ChatGPT)
- [ ] Plugin-System für benutzerdefinierte Erweiterungen
- [ ] Themes und Anpassungsmöglichkeiten