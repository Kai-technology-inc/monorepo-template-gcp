/** Specs that read the whole repository (layers, URL vocabulary, docs coverage). Run with `pnpm test:arch`. */
const base = require('./jest.config.js');

module.exports = {
    ...base,
    testRegex: '/src/arch/.*\\.spec\\.ts$',
    testPathIgnorePatterns: ['/node_modules/'],
};
