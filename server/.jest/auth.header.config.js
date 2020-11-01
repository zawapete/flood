module.exports = {
  displayName: 'auth.header',
  preset: 'ts-jest/presets/js-with-babel',
  rootDir: './../',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/routes/api/auth.header.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/.jest/auth.header.setup.js'],
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
};
