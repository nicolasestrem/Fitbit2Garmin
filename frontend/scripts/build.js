/**
 * @file Custom build script for the frontend application.
 * @description This script programmatically invokes the standard `react-scripts build`
 * command. It is used to build the React application for production, ensuring that
 * the process exits with the correct status code.
 */
const { spawnSync } = require('child_process');

const buildScript = require.resolve('react-scripts/scripts/build');

const result = spawnSync('node', [buildScript], { stdio: 'inherit' });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
