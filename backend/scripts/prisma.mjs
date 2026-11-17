import 'dotenv/config';
import { config } from 'dotenv';
import { spawnSync } from 'node:child_process';
config({ path: '../.env' });
const result = spawnSync('prisma', process.argv.slice(2), {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
