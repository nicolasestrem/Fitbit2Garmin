import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import sitemap from 'vite-plugin-sitemap'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    sitemap({
      hostname: 'https://trackersync.app',
      dynamicRoutes: [
        '/',
        '/measurements/weight',
        '/measurements/heart-rate',
        '/measurements/steps',
        '/measurements/sleep',
        '/measurements/vo2max',
        '/measurements/blood-pressure',
        '/measurements/resting-heart-rate'
      ],
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      exclude: ['/404'],
      // Custom route priorities
      outDir: 'dist',
      readable: true
    })
  ],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  css: {
    postcss: './postcss.config.js'
  }
})