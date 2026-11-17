import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
for (const name of ['JWT_SECRET', 'COUPON_HASH_KEY']) {
  if (process.env[name]) continue;
  if (process.env.NODE_ENV === 'production')
    throw new Error(`${name} must be provided in production`);
  const path = `/run/demo-secrets/${name}`;
  try {
    process.env[name] = readFileSync(path, 'utf8').trim();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    process.env[name] = randomBytes(48).toString('hex');
    writeFileSync(path, process.env[name], { mode: 0o600, flag: 'wx' });
  }
}
for (const args of [
  ['exec', '-w', 'backend', '--', 'prisma', 'migrate', 'deploy'],
  ['run', 'db:seed', '-w', 'backend'],
]) {
  const result = spawnSync('npm', args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const child = spawn('node', ['backend/dist/main.js'], { stdio: 'inherit', env: process.env });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
