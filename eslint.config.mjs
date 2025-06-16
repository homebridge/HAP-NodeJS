import { defineConfig, globalIgnores } from "eslint/config";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([globalIgnores(["**/dist/"]), {
  extends: compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
  ),

  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2018,
    sourceType: "module",
  },

  rules: {
    quotes: ["error", "double"],
    indent: ["error", 2, {
      SwitchCase: 0,
    }],
    "linebreak-style": ["error", "unix"],
    semi: ["error", "always"],
    "comma-dangle": ["error", "always-multiline"],
    "dot-notation": "error",
    eqeqeq: ["error", "smart"],
    curly: ["error", "all"],
    "brace-style": ["error"],
    "prefer-arrow-callback": "warn",
    "max-len": ["warn", 160],
    "object-curly-spacing": ["error", "always"],
    "@typescript-eslint/no-unused-vars": ["error", {
      caughtErrors: "none",
    }],
    "@typescript-eslint/no-use-before-define": ["error", {
      classes: false,
      enums: false,
    }],
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/explicit-module-boundary-types": "error",
  },
}]);
