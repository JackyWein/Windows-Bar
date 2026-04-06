const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get version bump type from args
const bumpType = process.argv[2] || 'patch';

// Read current package.json
const packagePath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
const currentVersion = pkg.version;

console.log(`\n🚀 Windows Bar Release Script`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`📦 Current version: ${currentVersion}`);
console.log(`📤 Bump type: ${bumpType}`);

// Bump version using npm
console.log(`\n⬆️  Bumping version...`);
execSync(`npm version ${bumpType} --no-git-tag-version`, { stdio: 'inherit' });

// Read new version
const newPkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
const newVersion = newPkg.version;
console.log(`✅ New version: ${newVersion}`);

// Build the app
console.log(`\n🔨 Building application...`);
execSync('npm run build', { stdio: 'inherit' });

// Check if dist folder exists and has files
const distPath = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distPath)) {
    console.error('❌ Build failed - dist folder not found');
    process.exit(1);
}

// Find the installer files
const distFiles = fs.readdirSync(distPath);
const exeFile = distFiles.find(f => f.endsWith('.exe') && !f.endsWith('blockmap.exe'));
const blockmapFile = distFiles.find(f => f.endsWith('.exe.blockmap'));
const ymlFile = distFiles.find(f => f === 'latest.yml'); // GEFIXT: Sucht jetzt explizit nach latest.yml

if (!exeFile) {
    console.error('❌ No installer .exe found in dist folder');
    process.exit(1);
}

console.log(`\n📁 Built files:`);
console.log(`   - ${exeFile}`);
if (blockmapFile) console.log(`   - ${blockmapFile}`);
if (ymlFile) console.log(`   - ${ymlFile}`);

// Create git tag
console.log(`\n🏷️  Creating git tag v${newVersion}...`);
try {
    execSync('git add package.json', { stdio: 'inherit' });
    execSync(`git commit -m "chore: release v${newVersion}"`, { stdio: 'inherit' });
    execSync(`git tag v${newVersion}`, { stdio: 'inherit' });
} catch (e) {
    console.log('⚠️  Git operations failed (continuing anyway)');
}

// Push to GitHub
console.log(`\n📤 Pushing to GitHub...`);
try {
    execSync('git push origin main', { stdio: 'inherit' });
    execSync(`git push origin v${newVersion}`, { stdio: 'inherit' });
} catch (e) {
    console.log('⚠️  Git push failed - you may need to push manually');
}

// --- NEU: CHANGELOG.MD AUSLESEN ---
console.log(`\n📖 Lese CHANGELOG.md für Release Notes aus...`);
let releaseNotes = '';
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');

if (fs.existsSync(changelogPath)) {
    const changelog = fs.readFileSync(changelogPath, 'utf-8');
    // Sucht den Textblock für die aktuelle Version
    const versionRegex = new RegExp(`## \\s*\\[?v?${newVersion}\\]?[^\\n]*\\n([\\s\\S]*?)(?=\\n## \\s*\\[?v?\\d|$)`, 'i');
    const match = changelog.match(versionRegex);

    if (match && match[1]) {
        releaseNotes = match[1].trim();
        console.log(`✅ Changelog-Eintrag für v${newVersion} gefunden!`);
    } else {
        console.log(`⚠️  Kein Eintrag für v${newVersion} in CHANGELOG.md gefunden. Verwende Standard-Text.`);
    }
} else {
    console.log(`⚠️  Keine CHANGELOG.md Datei gefunden.`);
}

// Fallback, falls nichts gefunden wurde
if (!releaseNotes) {
    releaseNotes = `### 📥 Installation\nDownload \`Windows Bar Setup ${newVersion}.exe\` and run the installer.\n\n### 🔄 Auto-Update\nExisting users will receive this update automatically on the next app restart.\n\n---\n*For full changelog, see commit history.*`;
}

// Temporäre Datei für GitHub CLI erstellen
const tempNotesPath = path.join(distPath, 'TEMP_RELEASE_NOTES.md');
fs.writeFileSync(tempNotesPath, releaseNotes);
// ----------------------------------

// Create GitHub release with gh CLI
console.log(`\n🎉 Creating GitHub Release...`);
const releaseFiles = [
    path.join(distPath, exeFile),
];
if (blockmapFile) releaseFiles.push(path.join(distPath, blockmapFile));
if (ymlFile) releaseFiles.push(path.join(distPath, ymlFile));

try {
    execSync('gh --version', { stdio: 'pipe' });
} catch (e) {
    console.log(`\n⚠️  GitHub CLI (gh) not found.`);
    console.log(`📦 Installing GitHub CLI via winget...`);
    try {
        execSync('winget install --id GitHub.cli', { stdio: 'inherit' });
        console.log(`✅ GitHub CLI installed! You may need to restart your terminal.`);
        console.log(`   Run 'gh auth login' once to authenticate, then run this script again.`);
        process.exit(0);
    } catch (installError) {
        console.log(`\n❌ Could not install GitHub CLI automatically.`);
        console.log(`\n📋 Please install it manually:`);
        console.log(`   winget install --id GitHub.cli`);
        console.log(`   gh auth login`);
        console.log(`\n   Then run this script again.`);
        process.exit(1);
    }
}

try {
    execSync('gh auth status', { stdio: 'pipe' });
} catch (e) {
    console.log(`\n⚠️  GitHub CLI is not authenticated.`);
    console.log(`🔐 Please run: gh auth login`);
    process.exit(1);
}

// Create the release
try {
    // --notes-file nutzt nun unsere temporäre Markdown Datei
    const createCmd = `gh release create v${newVersion} ${releaseFiles.map(f => `"${f}"`).join(' ')} --title "v${newVersion}" --notes-file "${tempNotesPath}"`;
    execSync(createCmd, { stdio: 'inherit' });

    console.log(`\n✅ Release v${newVersion} created successfully!`);
    console.log(`🔗 https://github.com/JackyWein/Windows-Bar/releases/tag/v${newVersion}`);
} catch (e) {
    console.log(`\n⚠️  Release creation failed.`);
    console.log(`\n📋 Manual steps:`);
    console.log(`   1. Go to: https://github.com/JackyWein/Windows-Bar/releases/new`);
    console.log(`   2. Tag: v${newVersion}`);
    console.log(`   3. Upload these files from the 'dist' folder:`);
    releaseFiles.forEach(f => console.log(`      - ${path.basename(f)}`));
} finally {
    // Temporäre Datei aufräumen
    if (fs.existsSync(tempNotesPath)) {
        fs.unlinkSync(tempNotesPath);
    }
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`🎊 Done! Version ${newVersion} is ready!`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);