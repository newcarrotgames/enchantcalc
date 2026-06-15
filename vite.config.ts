import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Static build. `base: './'` keeps asset paths relative so the built site
// works on GitHub Pages / Netlify subpaths without extra config.
export default defineConfig({
  base: './',
  plugins: [react()],
  // Force a single copy of three so skinview3d (which renders the scene) and our
  // overlay meshes share one instance. Mixing versions makes skinview3d's
  // renderer choke on foreign materials (e.g. `material.onBuild is not a
  // function`), which crashes the 3D view.
  resolve: { dedupe: ['three'] },
})
