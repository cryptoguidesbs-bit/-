import { defineConfig, globalIgnores } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import prettier from 'eslint-config-prettier/flat'

// Flat config — `next lint` was removed in Next 16; `npm run lint` now runs
// the ESLint CLI directly. Mirrors the old .eslintrc.json.
export default defineConfig([
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'pgdata/**']),
  ...nextCoreWebVitals,
  prettier,
  {
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
      // New React-Compiler-era rules that ship with eslint-config-next 16.
      // They flag long-standing working patterns (mount-flag setState in
      // effects, ref mirrors); kept as warnings until those components are
      // refactored deliberately.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
])
