import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = dirname(fileURLToPath(import.meta.url));
const sourceDirectory = resolve(projectDirectory, 'src');

export default {
  root: sourceDirectory,
  base: './',
  publicDir: resolve(sourceDirectory, 'public'),
  build: {
    outDir: resolve(projectDirectory, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(sourceDirectory, 'index.html'),
        dashboard: resolve(sourceDirectory, 'dashboard.html')
      }
    }
  }
};
