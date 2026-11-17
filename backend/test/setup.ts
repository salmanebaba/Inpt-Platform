import { config } from 'dotenv';
config({ path: ['.env', '../.env'] });
const target = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL!);
if (!process.env.TEST_DATABASE_URL) target.pathname = '/smartresto_test';
if (!/^[a-zA-Z0-9_]+_test$/.test(target.pathname.slice(1)))
  throw new Error('Tests require a dedicated *_test database.');
process.env.DATABASE_URL = target.toString();
process.env.NODE_ENV = 'test';
