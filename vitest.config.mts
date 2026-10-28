import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    // the Windows build machine is slow with Git and files (antivirus); keep real-Git tests from timing out
    testTimeout: 60_000
  }
})
