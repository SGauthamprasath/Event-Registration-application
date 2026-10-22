import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the React app runs on :5173 and forwards /api calls to the Express server on :4000.
// In production Express serves the built files itself, so there is only one thing to deploy.
// `npm run dev:phone` serves over HTTPS (self-signed): phone browsers only allow the camera
// for the QR scanner on HTTPS pages, and a LAN IP over plain HTTP doesn't count.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'phone' ? [basicSsl()] : [])],
  server: {
    host: true,          // listen on 0.0.0.0 so phones on the same Wi-Fi can hit the dev server
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://localhost:4000' },
  },
}))
