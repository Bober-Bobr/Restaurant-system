import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',       // listen on all interfaces so *.v-menu.local resolves
    port: 5173,
    allowedHosts: ['.v-menu.local', '.v-menu.uz', 'localhost'],
  },
});
