const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const frontendDir = path.resolve(__dirname, '..');
const buildScript = require.resolve('react-scripts/scripts/build');

const result = spawnSync('node', [buildScript], { stdio: 'inherit' });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const sourceDir = path.join(frontendDir, 'build');
const outputDir = path.resolve(frontendDir, '..', 'build');

const copyDirectory = (from, to) => {
  const entries = fs.readdirSync(from, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(from, entry.name);
    const targetPath = path.join(to, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true });
      copyDirectory(sourcePath, targetPath);
    } else if (entry.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(sourcePath);
      fs.symlinkSync(linkTarget, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
};

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
if (!fs.existsSync(sourceDir)) {
  console.error(`Expected build output at ${sourceDir} but it was not found.`);
  process.exit(1);
}
copyDirectory(sourceDir, outputDir);

console.log(`Copied production build to ${path.relative(frontendDir, outputDir) || '.'}`);
