import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.json'] })],
  test: {
    coverage: {
      provider: 'v8',
      // Focus coverage on business logic only — routes/components need full browser env
      include: ['src/lib/**'],
      exclude: [
        'src/lib/auth.ts',        // requires real DB + better-auth infra
        'src/lib/auth-client.ts', // browser-only auth client
        'src/lib/env.ts',         // throws at import time when env vars absent
        'src/lib/types.ts',       // type-only exports, no executable statements
      ],
    },
  },
})
