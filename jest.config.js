/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'miniflare',
};

// export default {
//   preset: "ts-jest/presets/default-esm",
//   globals: {
//     "ts-jest": {
//       tsconfig: "test/tsconfig.json",
//       useESM: true,
//     },
//   },
//   moduleNameMapper: {
//     "^@/(.*)$": "<rootDir>/src/$1",
//     "^(\\.{1,2}/.*)\\.js$": "$1",
//   },
//   // transformIgnorePatterns: [`/node_modules/(?!${esModules})`],
//   testEnvironment: "miniflare"
// };
