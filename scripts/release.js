const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Windows Bar Release Script
 * Automatisiert Version-Bump, Build, Git-Tagging und GitHub-Release
 */

// Hole den Version-Bump-Typ (patch, minor, major, none) - Standard ist patch
const bumpType = process.argv[2] || 'patch';

// Pfad zur package.json
const packagePath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
const currentVersion = pkg.version;

console.log(`\n🚀 Windows Bar Release Script`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`📦 Aktuelle Version: ${currentVersion}`);
console.log(`📤 Modus: ${bumpType === 'none' ? 'Gleiche Version beibehalten (Test-Modus)' : 'Erhöhung: ' + bumpType}`);

// 1. Version erhöhen (Überspringen, wenn bumpType 'none' ist)
let newVersion = currentVersion;
if (bumpType !== 'none') {
    console.log(`\n⬆️  Erhöhe Version via npm...`);
    try {
        execSync(`npm version ${bumpType} --no-git-tag-version`, { stdio: 'inherit' });
        // Neue Version aus der aktualisierten package.json lesen
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

// Dateien für den Upload finden
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
    // Füge alle getrackten Dateien hinzu
    execSync('git add package.json', { stdio: 'inherit' });
    if (fs.existsSync(path.join(__dirname, '..', 'CHANGELOG.md'))) {
        execSync('git add CHANGELOG.md', { stdio: 'inherit' });
    }

    // Prüfen, ob es Änderungen zum Committen gibt
    const status = execSync('git status --porcelain').toString();
    if (status) {
        // -a nimmt alle modifizierten, bereits getrackten Dateien mit (z.B. release.js)
        execSync(`git commit -a -m "chore: release v${newVersion}"`, { stdio: 'inherit' });
    }

    // Tag erstellen (ignoriert Fehler, wenn Tag schon existiert)
    try {
        execSync(`git tag v${newVersion}`, { stdio: 'ignore' });
    } catch (e) {
        console.log(`ℹ️  Tag v${newVersion} existiert bereits.`);
    }

    console.log(`📤 Pushe zu GitHub...`);
    execSync('git push origin main', { stdio: 'inherit' });
    execSync(`git push origin v${newVersion} --force`, { stdio: 'inherit' });
} catch (e) {
    console.log('⚠️  Git Operationen teilweise fehlgeschlagen oder keine Änderungen.');
}

// 4. CHANGELOG EXTRAKTION (Mit Encoding-Fix für Windows UTF-16)
console.log(`\n📖 Extrahiere Release-Notes aus CHANGELOG.md...`);
let releaseNotes = '';
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');

if (fs.existsSync(changelogPath)) {
    // Binäres Einlesen der Datei zur Erkennung von Windows UTF-16 Formaten
    const rawBuffer = fs.readFileSync(changelogPath);
    let content = '';

    // UTF-16 LE (Windows Standard bei PowerShell) oder UTF-16 BE prüfen
    if (rawBuffer[0] === 0xFF && rawBuffer[1] === 0xFE) {
        content = rawBuffer.toString('utf16le');
    } else if (rawBuffer[0] === 0xFE && rawBuffer[1] === 0xFF) {
        content = rawBuffer.toString('utf16be');
    } else {
        content = rawBuffer.toString('utf8');
    }

    // Failsafe: Falls die Datei ohne BOM als UTF-16 gespeichert wurde, Null-Bytes entfernen
    content = content.replace(/\x00/g, '');

    // BOM entfernen und Zeilenumbrüche normalisieren
    content = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

    const lines = content.split('\n');
    const target = newVersion.trim();

    let startIndex = -1;
    let endIndex = -1;

    console.log(`🔍 Suche nach Sektion für Version: "${target}"`);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Suche Start: Zeile fängt mit '#' an und enthält die Versionsnummer
        if (startIndex === -1 && line.startsWith('#') && line.includes(target)) {
            console.log(`✅ Gefundene Header-Zeile in Zeile ${i + 1}: "${line}"`);
            startIndex = i + 1;
            continue;
        }

        // Suche Ende: Die nächste Überschrift (fängt mit '#' an)
        if (startIndex !== -1 && line.startsWith('#') && !line.includes(target)) {
            console.log(`🛑 Ende der Sektion in Zeile ${i + 1} gefunden: "${line}"`);
            endIndex = i;
            break;
        }
    }

    if (startIndex !== -1) {
        const finalEndIndex = endIndex === -1 ? lines.length : endIndex;
        releaseNotes = lines.slice(startIndex, finalEndIndex).join('\n').trim();
    }

    if (releaseNotes) {
        console.log(`✅ Release-Notes für v${newVersion} erfolgreich extrahiert!`);
    } else {
        console.log(`⚠️  Konnte keine Sektion für Version ${newVersion} finden.`);
        console.log(`   Stelle sicher, dass in CHANGELOG.md eine Zeile wie "## [${newVersion}]" existiert.`);
    }
}

if (!releaseNotes) {
    releaseNotes = `### 📥 Installation\nDownload \`Windows Bar Setup ${newVersion}.exe\` und starte den Installer.\n\n### 🔄 Auto-Update\nUpdates werden automatisch installiert.`;
}

const notesPath = path.join(distPath, 'RELEASE_NOTES.md');
fs.writeFileSync(notesPath, releaseNotes);

// 5. GitHub Release erstellen/aktualisieren (Kompatibilitäts-Fix)
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
    } catch (e) {
        releaseExists = false;
    }

    if (releaseExists) {
        console.log(`\n🔄 Release v${newVersion} existiert bereits. Aktualisiere...`);
        execSync(`gh release edit v${newVersion} --notes-file "${notesPath}"`, { stdio: 'inherit' });
        // Assets einzeln hochladen
        for (const asset of assets) {
            try {
                execSync(`gh release upload v${newVersion} "${asset}" --clobber`, { stdio: 'inherit' });
            } catch (err) {
                console.log(`⚠️ Asset ${path.basename(asset)} konnte nicht hochgeladen werden.`);
            }
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