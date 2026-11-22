
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import appMockApi from './mocks/app-api.mjs'

export default defineConfig(({ mode }) => ({
  plugins: mode === 'express-only'
    ? [react()]
    : [react(), appMockApi()],
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
}))
