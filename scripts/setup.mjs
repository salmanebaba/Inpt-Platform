import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
try {
  await readFile('.env');
  console.log('.env already exists; retained.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  let content = await readFile('.env.example', 'utf8');
  content = content
    .replace(/^JWT_SECRET=$/m, `JWT_SECRET=${randomBytes(48).toString('hex')}`)
    .replace(/^COUPON_HASH_KEY=$/m, `COUPON_HASH_KEY=${randomBytes(48).toString('hex')}`);
  await writeFile('.env', content, { mode: 0o600, flag: 'wx' });
  console.log('Created ignored .env with independent random development secrets.');
}
