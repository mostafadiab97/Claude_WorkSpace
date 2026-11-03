import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    // the Windows build machine is slow with Git and files (antivirus); keep real-Git tests from timing out
    testTimeout: 60_000,
    // P-40c (Mostafa, 2 Nov 2026): a coverage floor for the core. `npm run check` fails when tests stop exercising it.
    // Measured at 0.14.0: statements 88 %, branches 76 %, functions 89 %, lines 93 % — the floor sits a little below,
    // so it catches a drop without failing on noise. Raise it when coverage grows; never lower it to make a build pass.
    coverage: {
      provider: 'v8',
      include: ['src/modules/**', 'src/shared/**'],
      // texts are data; the sample generator is a tool; the updater only runs inside the installed app
      exclude: ['src/shared/text*.ts', 'src/modules/sample-data/**', 'src/modules/updater/githubUpdater.ts'],
      reporter: ['text-summary'],
      thresholds: { statements: 85, branches: 72, functions: 85, lines: 88 }
    }
  }
})
