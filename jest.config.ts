import type { Config } from "jest";

const config: Config = {
  "preset": "ts-jest",
  "testEnvironment": "node",
  "transform": {
    "^.+\\.tsx?$": ["ts-jest", {
      "tsconfig": "tsconfig.spec.json",
    }],
  },
  "coverageReporters": ["lcov"],
  "collectCoverageFrom": [
    "src/**",
    "!src/accessories/**",
    "!src/lib/definitions/generate-definitions.ts",
    "!src/lib/definitions/generator-configuration.ts",
    "!src/test-utils",
  ],
};

export default config;
