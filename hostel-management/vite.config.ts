import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

const REQUIRED_BUILD_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const

export default defineConfig(({ command, mode }) => {
  // Without these the app falls back to offline demo mode, which accepts any
  // password. Never ship that: fail production builds instead.
  if (command === 'build') {
    const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
    const missing = REQUIRED_BUILD_ENV.filter((name) => !env[name] || env[name]?.includes('placeholder'))
    if (missing.length) {
      throw new Error(`Missing required environment variables for build: ${missing.join(', ')}`)
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    build: {
      rolldownOptions: {
        output: {
          // Long-lived vendor chunks cache across app releases; pages are lazy-loaded in App.tsx.
          codeSplitting: {
            groups: [
              { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
              { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            ],
          },
        },
      },
    },
  }
})
