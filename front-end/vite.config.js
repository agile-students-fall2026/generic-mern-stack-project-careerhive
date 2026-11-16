import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import jobsMockApi from './mocks/jobs-api.mjs'
import appMockApi from './mocks/app-api.mjs'

export default defineConfig({
  plugins: [react(), jobsMockApi(), appMockApi()],
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
})


