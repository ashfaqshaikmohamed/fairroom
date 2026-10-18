import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// Static public demo only: no server, credentials, private data or dotenv loading.
export default defineConfig({envDir:false,plugins:[react(),tailwindcss()],build:{outDir:'shortlist-dist',rollupOptions:{input:'shortlist.html'}}});
