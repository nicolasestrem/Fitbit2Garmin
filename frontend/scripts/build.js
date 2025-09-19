const { spawnSync } = require('child_process');

const buildScript = require.resolve('react-scripts/scripts/build');

const result = spawnSync('node', [buildScript], { stdio: 'inherit' });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
