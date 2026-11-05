import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: { index: resolve('src/main/index.ts') },
        // unzipper (inside exceljs, 0.12 since SEC-05) can read zip files from Amazon S3 and requires that SDK only
        // when asked to; reqochet never does, so it is left out of the bundle
        external: ['@aws-sdk/client-s3']
      }
    }
  },
  preload: {
    build: { rollupOptions: { input: { index: resolve('src/preload/index.ts') } } }
  },
  renderer: {
    root: resolve('src/renderer'),
    build: { rollupOptions: { input: { index: resolve('src/renderer/index.html') } } },
    plugins: [react()]
  }
})
