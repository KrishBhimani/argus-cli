import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  build: { format: 'directory' },
  vite: {
    resolve: { dedupe: ['echarts'] },
  },
});
