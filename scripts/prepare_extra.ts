import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '..');
const extraDir = path.join(rootDir, 'extra');
const platform = process.argv[2] || 'mac';
let sourceDirName: string | undefined;

// Info: (20251217 - Luphia) 清空 extra 目錄下的檔案
if (fs.existsSync(extraDir)) {
  fs.readdirSync(extraDir).forEach((file) => {
    console.log(`Removing ${file} from extra/`);
    fs.unlinkSync(path.join(extraDir, file));
  });
}

if (platform === 'mac') {
  sourceDirName = 'extra_mac';
} else if (platform === 'windows') {
  sourceDirName = 'extra_windows';
} else if (platform === 'linux') {
  sourceDirName = 'extra_linux';
} else {
  console.error(`Unsupported platform: ${platform}`);
  process.exit(1);
}

const sourceDir = path.join(rootDir, sourceDirName!);

console.log(`Preparing extra binaries for ${platform} from ${sourceDirName}...`);

if (!fs.existsSync(sourceDir)) {
  console.error(`Source directory not found: ${sourceDir}`);
  process.exit(1);
}

if (!fs.existsSync(extraDir)) {
  fs.mkdirSync(extraDir);
}

const files = fs.readdirSync(sourceDir);
for (const file of files) {
  const srcFile = path.join(sourceDir, file);
  const destFile = path.join(extraDir, file);

  // Info: (20251217 - Luphia) 跳過目錄, .DS_Store
  if (fs.lstatSync(srcFile).isDirectory() || file === '.DS_Store') {
    continue;
  }

  try {
    fs.copyFileSync(srcFile, destFile);
    // Ensure executable
    if (platform !== 'windows') {
      fs.chmodSync(destFile, '755');
    }
    console.log(`Copied ${file} to extra/`);
  } catch (err) {
    console.error(`Error copying ${file}:`, err);
  }
}

console.log('Extra binaries prepared.');
