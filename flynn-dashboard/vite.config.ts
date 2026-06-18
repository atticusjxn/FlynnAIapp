import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served under flynnai.app/dashboard, so assets must resolve under that path.
export default defineConfig({
  base: '/dashboard/',
  plugins: [react()],
  build: { outDir: 'dist' },
});
