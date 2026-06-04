import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Static build. `base: './'` keeps asset paths relative so the built site
// works on GitHub Pages / Netlify subpaths without extra config.
export default defineConfig({
  base: './',
  plugins: [react()],
})
