module.exports = {
  displayName: 'firestore-rules',
  maxWorkers: 1,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/rules-tests/**/*.emulator.cjs'],
  testTimeout: 30000,
};
