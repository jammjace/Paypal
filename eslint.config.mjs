import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/domain/**/*.{ts,tsx}", "src/finance/**/*.{ts,tsx}", "src/services/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["**/providers/**", "**/fixtures/**"], message: "Consume normalized domain models through Pal services; concrete providers belong in server composition." }] }]
    }
  },
  globalIgnores([".next/**", "out/**", ".npm-cache/**", "next-env.d.ts", "coverage/**"])
]);
