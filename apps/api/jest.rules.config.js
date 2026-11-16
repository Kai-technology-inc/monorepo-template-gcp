/** The security rules against the Firestore/Storage emulators. Run with `pnpm test:rules` (it starts them). */
const base = require('./jest.config.js');

module.exports = {
    ...base,
    testRegex: '\\.rules\\.spec\\.ts$',
    testPathIgnorePatterns: ['/node_modules/'],
};
