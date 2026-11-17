import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
config({ path: ['.env', '../.env'] });
const base = new URL(process.env.DATABASE_URL);
const target = process.env.TEST_DATABASE_URL
  ? new URL(process.env.TEST_DATABASE_URL)
  : new URL(base);
if (!process.env.TEST_DATABASE_URL) target.pathname = '/smartresto_test';
const name = target.pathname.slice(1);
if (!/^[a-zA-Z0-9_]+_test$/.test(name))
  throw new Error('Refusing tests: database name must end in _test.');
const db = new PrismaClient({ datasources: { db: { url: base.toString() } } });
try {
  const existing = await db.$queryRaw`SELECT 1 FROM pg_database WHERE datname = ${name}`;
  if (!existing.length) {
    // Identifier is restricted by the allowlist above, never arbitrary SQL input.
    await db.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  }
} catch (error) {
  if (error.code !== 'P2010' || error.meta?.code !== '42P04') throw error;
} finally {
  await db.$disconnect();
}
const result = spawnSync('npm', ['exec', '--', 'prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: target.toString() },
});
process.exit(result.status ?? 1);
