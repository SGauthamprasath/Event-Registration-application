import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the React app runs on :5173 and forwards /api calls to the Express server on :4000.
// In production Express serves the built files itself, so there is only one thing to deploy.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // listen on 0.0.0.0 so phones on the same Wi-Fi can hit the dev server
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://localhost:4000' },
  },
})
