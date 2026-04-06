const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Windows Bar Release Script
 * Automatisiert Version-Bump, Build, Git-Tagging und GitHub-Release
 */

// Hole den Modus (patch, minor, major, none, test-changelog)
const mode = process.argv[2] || 'patch';

// Pfad zur package.json
const packagePath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
const currentVersion = pkg.version;

console.log(`\n🚀 Windows Bar Release Script`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`📦 Aktuelle Version: ${currentVersion}`);
console.log(`📤 Modus: ${mode}`);

// ==========================================
// CHANGELOG EXTRAKTIONS-FUNKTION (Mit Debug)
// ==========================================
function extractChangelog(version, debug = false) {
    console.log(`\n📖 Lese CHANGELOG.md für Version: "${version}"`);
    const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');

    if (!fs.existsSync(changelogPath)) {
        console.log(`❌ FEHLER: Datei CHANGELOG.md nicht gefunden unter: ${changelogPath}`);
        return null;
    }

    const rawBuffer = fs.readFileSync(changelogPath);

    if (debug) {
        console.log(`\n--- 🛠️ DEBUG INFO ---`);
        console.log(`Dateigröße: ${rawBuffer.length} Bytes`);
        console.log(`Erste 20 Bytes (Hex): ${rawBuffer.slice(0, 20).toString('hex')}`);
    }

    // Encoding-Erkennung & Bereinigung
    let content = '';
    if (rawBuffer[0] === 0xFF && rawBuffer[1] === 0xFE) {
        if (debug) console.log(`Encoding erkannt: UTF-16 LE (Windows)`);
        content = rawBuffer.toString('utf16le');
    } else if (rawBuffer[0] === 0xFE && rawBuffer[1] === 0xFF) {
        if (debug) console.log(`Encoding erkannt: UTF-16 BE`);
        content = rawBuffer.toString('utf16be');
    } else {
        if (debug) console.log(`Encoding erkannt: UTF-8`);
        content = rawBuffer.toString('utf8');
    }

    // Brutales Bereinigen aller unsichtbaren BOMs, Null-Bytes und seltsamen Windows-Zeichen
    content = content.replace(/\x00/g, '')
        .replace(/^\uFEFF/, '')
        .replace(/\r\n/g, '\n');

    const lines = content.split('\n');
    let startIndex = -1;
    let endIndex = -1;

    if (debug) {
        console.log(`Anzahl der Zeilen nach Bereinigung: ${lines.length}`);
        console.log(`Suche nach einer Zeile, die '#' und '${version}' enthält...`);
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Debugge die ersten 15 Zeilen, um zu sehen, was das Skript überhaupt sieht
        if (debug && i < 15 && line.length > 0) {
            console.log(`[Zeile ${i + 1}] ${line}`);
        }

        // Start-Bedingung: Zeile enthält '#' UND die gesuchte Version
        if (startIndex === -1 && line.includes('#') && line.includes(version)) {
            console.log(`\n✅ TREFFER! Header gefunden in Zeile ${i + 1}: "${line}"`);
            startIndex = i + 1;
            continue;
        }

        // End-Bedingung: Wir haben den Start und finden die nächste Überschrift mit '#'
        // Bedingung: Muss mit # anfangen, darf nicht unsere Version sein, und muss etwas Text enthalten
        if (startIndex !== -1 && line.startsWith('#') && !line.includes(version)) {
            console.log(`🛑 ENDE der Sektion gefunden in Zeile ${i + 1}: "${line}"`);
            endIndex = i;
            break;
        }
    }

    if (startIndex !== -1) {
        const finalEndIndex = endIndex === -1 ? lines.length : endIndex;
        const notes = lines.slice(startIndex, finalEndIndex).join('\n').trim();
        return notes;
    }

    return null;
}

// ==========================================
// TEST-MODUS FÜR CHANGELOG
// ==========================================
if (mode === 'test-changelog') {
    console.log(`\n⚠️ Führe NUR den Changelog-Test aus. Keine Builds, kein Upload.`);
    const notes = extractChangelog(currentVersion, true);

    if (notes) {
        console.log(`\n🎉 ERFOLG! Hier ist der extrahierte Text:\n`);
        console.log(`========================================`);
        console.log(notes);
        console.log(`========================================\n`);
    } else {
        console.log(`\n❌ FEHLSCHLAG: Es konnte kein Text für ${currentVersion} extrahiert werden.`);
        console.log(`Bitte schicke mir den Output unter "--- 🛠️ DEBUG INFO ---" aus deiner Konsole!`);
    }
    process.exit(0);
}

// ==========================================
// NORMALER RELEASE-ABLAUF
// ==========================================
let newVersion = currentVersion;
if (mode !== 'none' && mode !== 'test-changelog') {
    console.log(`\n⬆️  Erhöhe Version via npm...`);
    try {
        execSync(`npm version ${mode} --no-git-tag-version`, { stdio: 'inherit' });
        const newPkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        newVersion = newPkg.version;
        console.log(`✅ Neue Version: ${newVersion}`);
    } catch (error) {
        console.error('❌ Fehler beim Erhöhen der Version:', error.message);
        process.exit(1);
    }
} else {
    console.log(`\nℹ️  Version bleibt auf ${newVersion} (kein Bump).`);
}

// 2. Build ausführen
console.log(`\n🔨 Baue Anwendung...`);
execSync('npm run build', { stdio: 'inherit' });

const distPath = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distPath)) {
    console.error('❌ Build fehlgeschlagen - dist Ordner nicht gefunden');
    process.exit(1);
}

const distFiles = fs.readdirSync(distPath);
const exeFile = distFiles.find(f => f.endsWith('.exe') && !f.endsWith('blockmap.exe'));
const blockmapFile = distFiles.find(f => f.endsWith('.exe.blockmap'));
const ymlFile = distFiles.find(f => f === 'latest.yml');

if (!exeFile || !ymlFile) {
    console.error('❌ Wichtige Release-Dateien (exe oder latest.yml) fehlen!');
    process.exit(1);
}

// 3. Git Operationen
console.log(`\n🏷️  Git Operationen für v${newVersion}...`);
try {
    execSync('git add package.json', { stdio: 'inherit' });
    if (fs.existsSync(path.join(__dirname, '..', 'CHANGELOG.md'))) {
        execSync('git add CHANGELOG.md', { stdio: 'inherit' });
    }
    const status = execSync('git status --porcelain').toString();
    if (status) {
        execSync(`git commit -a -m "chore: release v${newVersion}"`, { stdio: 'inherit' });
    }
    try {
        execSync(`git tag v${newVersion}`, { stdio: 'ignore' });
    } catch (e) { }

    console.log(`📤 Pushe zu GitHub...`);
    execSync('git push origin main', { stdio: 'inherit' });
    execSync(`git push origin v${newVersion} --force`, { stdio: 'inherit' });
} catch (e) {
    console.log('⚠️  Git Operationen teilweise fehlgeschlagen oder keine Änderungen.');
}

// 4. CHANGELOG EXTRAKTION (Produktiv)
let releaseNotes = extractChangelog(newVersion, false);

if (!releaseNotes) {
    releaseNotes = `### 📥 Installation\nDownload \`Windows Bar Setup ${newVersion}.exe\` und starte den Installer.\n\n### 🔄 Auto-Update\nUpdates werden automatisch installiert.`;
}

const notesPath = path.join(distPath, 'RELEASE_NOTES.md');
fs.writeFileSync(notesPath, releaseNotes);

// 5. GitHub Release erstellen/aktualisieren
console.log(`\n🎉 Erstelle/Aktualisiere GitHub Release...`);
const assets = [
    path.join(distPath, exeFile),
    path.join(distPath, ymlFile)
];
if (blockmapFile) assets.push(path.join(distPath, blockmapFile));

try {
    const assetString = assets.map(a => `"${a}"`).join(' ');
    let releaseExists = false;
    try {
        execSync(`gh release view v${newVersion}`, { stdio: 'ignore' });
        releaseExists = true;
    } catch (e) { }

    if (releaseExists) {
        console.log(`\n🔄 Release v${newVersion} existiert bereits. Aktualisiere...`);
        execSync(`gh release edit v${newVersion} --notes-file "${notesPath}"`, { stdio: 'inherit' });
        for (const asset of assets) {
            try { execSync(`gh release upload v${newVersion} "${asset}" --clobber`, { stdio: 'inherit' }); }
            catch (err) { console.log(`⚠️ Asset ${path.basename(asset)} konnte nicht hochgeladen werden.`); }
        }
    } else {
        const releaseCmd = `gh release create v${newVersion} ${assetString} --title "v${newVersion}" --notes-file "${notesPath}"`;
        execSync(releaseCmd, { stdio: 'inherit' });
    }
    console.log(`\n✅ Release v${newVersion} erfolgreich veröffentlicht!`);
} catch (e) {
    console.error(`\n❌ Fehler beim Erstellen des GitHub Releases: ${e.message}`);
} finally {
    if (fs.existsSync(notesPath)) fs.unlinkSync(notesPath);
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`🎊 Fertig! Version ${newVersion} ist aktuell.`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);