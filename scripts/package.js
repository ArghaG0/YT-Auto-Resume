import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');

// Read manifest to get version
const manifestPath = path.join(srcDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('Error: src/manifest.json not found!');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version || '1.0.0';
const zipName = `youtube-auto-resume-v${version}.zip`;
const zipPath = path.join(distDir, zipName);

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

console.log(`Packaging extension v${version} from ${srcDir}...`);

try {
  // Try using adm-zip if installed
  const { default: AdmZip } = await import('adm-zip');
  const zip = new AdmZip();
  zip.addLocalFolder(srcDir);
  zip.writeZip(zipPath);
  console.log(`Successfully created release package: ${zipPath}`);
} catch {
  console.warn('adm-zip not available. Attempting fallback packaging...');
  // Fallback: If on Windows, we can use PowerShell Compress-Archive
  import('node:child_process').then(({ execSync }) => {
    if (process.platform === 'win32') {
      execSync(`powershell.exe -Command "Compress-Archive -Path '${srcDir}\\*' -DestinationPath '${zipPath}' -Force"`);
      console.log(`Successfully created release package with fallback: ${zipPath}`);
    } else {
      execSync(`cd "${srcDir}" && zip -r "${zipPath}" ./*`);
      console.log(`Successfully created release package with zip: ${zipPath}`);
    }
  }).catch((e) => {
    console.error('Failed to package extension:', e);
    process.exit(1);
  });
}
