const { spawnSync } = require("node:child_process");

const args = process.argv.slice(2);
const execPath = process.env.npm_execpath;

const command = execPath ? process.execPath : "pnpm";
const commandArgs = execPath ? [execPath, ...args] : args;

const result = spawnSync(command, commandArgs, {
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
