/** @type {Partial<import("typedoc").TypeDocOptions>} */
const config = {
  "out": "docs",
  "exclude": [
    "src/**/*.spec.ts",
    "src/test-utils/*",
  ],
  "entryPoints": [
    "src/index.ts",
  ],
  "intentionallyNotExported": [
    "MulticastOptions",
  ],
  "excludePrivate": true,
  "excludeProtected": true,
  "excludeExternals": true,
  "hideGenerator": true,
  "includeVersion": false,
  "externalSymbolLinkMappings": {
    "@types/node": {
      "__global.AbortSignal": "https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal"
    }
  },
  "validation": {
    "invalidLink": true,
    "notExported": false,
  },
  "blockTags": ["@deprecated", "@example", "@group", "@param", "@returns", "@since"],
};

export default config;
