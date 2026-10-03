import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname red lines in ES Modules (Vite standard)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev
export default defineConfig({
  plugins: [react()],
  
  // 🔄 CRUCIAL RUNTIME FIX: Define process.env so third-party charts don't crash the browser
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },

  build: {
    // 1. Output directly to your Python backend static folder layout
    outDir: path.resolve(__dirname, '../app/static/trend-widget'),
    emptyOutDir: true,
    
    // 2. Enable Library Mode to bypass the index.html entry limitation
    lib: {
      entry: path.resolve(__dirname, 'src/main.tsx'), 
      name: 'TrendWidget',
      formats: ['iife'], 
      fileName: () => 'trend-widget.js' 
    },
    
    rollupOptions: {
      output: {
        assetFileNames: '[name].[ext]'
      }
    }
  }
});

