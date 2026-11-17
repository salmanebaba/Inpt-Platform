module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.e2e-spec.ts'],
  testTimeout: 30000,
  setupFiles: ['<rootDir>/test/setup.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          ...require('./tsconfig.json').compilerOptions,
          rootDir: '.',
          types: ['node', 'jest'],
        },
      },
    ],
  },
};
