module.exports = {
  verbose: true,
  collectCoverage: true,
  coverageProvider: 'v8',
  projects: [
    '<rootDir>/server/.jest/auth.config.js',
    '<rootDir>/server/.jest/auth.header.config.js',
    '<rootDir>/server/.jest/rtorrent.config.js',
    // TODO: qBittorrent tests are disabled at the moment.
    // '<rootDir>/server/.jest/qbittorrent.config.js',
  ],
};
