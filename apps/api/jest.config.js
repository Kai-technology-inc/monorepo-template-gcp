/**
 * The default suite: the HTTP flow of the whole app over an in-memory store (`app.e2e.spec.ts`). The architecture
 * specs (`test:arch`) and the rules specs (`test:rules`, they need the emulator) have their own configs.
 */
const SEPARATE_SUITES = ['/src/arch/', '\\.rules\\.spec\\.ts$'];

module.exports = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: 'src',
    testRegex: '.*\\.spec\\.ts$',
    testPathIgnorePatterns: ['/node_modules/', ...SEPARATE_SUITES],
    transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
    testEnvironment: 'node',
};
