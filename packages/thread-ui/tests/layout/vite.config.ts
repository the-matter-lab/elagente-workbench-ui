import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

export default defineConfig({
  root:fileURLToPath(new URL('.', import.meta.url)),
  plugins:[react(), tailwindcss(), {
    name:'molecule-runtime',
    configureServer(server) {
      server.middlewares.use('/vendor/3Dmol-min.js', (_request, response) => {
        response.setHeader('Content-Type', 'application/javascript');
        response.end(readFileSync(new URL('../../node_modules/3dmol/build/3Dmol-min.js', import.meta.url)));
      });
    },
  }],
  resolve:{dedupe:['react','react-dom']},
  server:{host:'127.0.0.1', port:5183, strictPort:true, fs:{allow:[fileURLToPath(new URL('../../../..', import.meta.url))]}},
});
