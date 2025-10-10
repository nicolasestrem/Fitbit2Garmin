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
      // Default values (overridden by routes config below)
      changefreq: 'weekly',
      priority: 0.5,
      lastmod: new Date(),
      exclude: ['/404'],
      outDir: 'dist',
      readable: true,
      // Custom priorities per route
      routes: {
        '/': {
          changefreq: 'daily',
          priority: 1.0
        },
        '/measurements/weight': {
          changefreq: 'weekly',
          priority: 0.9  // Live feature - highest priority after home
        },
        '/measurements/heart-rate': {
          changefreq: 'monthly',
          priority: 0.5  // Coming soon
        },
        '/measurements/steps': {
          changefreq: 'monthly',
          priority: 0.5  // Coming soon
        },
        '/measurements/sleep': {
          changefreq: 'monthly',
          priority: 0.5  // Coming soon
        },
        '/measurements/vo2max': {
          changefreq: 'monthly',
          priority: 0.5  // Coming soon
        },
        '/measurements/blood-pressure': {
          changefreq: 'monthly',
          priority: 0.5  // Coming soon
        },
        '/measurements/resting-heart-rate': {
          changefreq: 'monthly',
          priority: 0.5  // Coming soon
        }
      }
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