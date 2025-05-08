import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    outDir: 'dist-public',  // separate output directory for the public build
    lib: {
      entry: './src/index.ts',  // use the public API entry point
      name: 'GBISearchPublic',
      formats: ['umd', 'es'],  // build in UMD and ESM formats if needed
      fileName: (format) => `gbi-search-public-api.${format}.js`,
    },
    rollupOptions: {
      external: [],  // mark dependencies that shouldn't be bundled
      output: {
        globals: {
        },
      },
    },
  },
  plugins: [
    dts({
      outDir: 'dist-public/types',
      entryRoot: 'src'
    })
  ]
});
