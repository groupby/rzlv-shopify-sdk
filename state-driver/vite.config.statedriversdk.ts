import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts'; // so customers can get proper type definitions

export default defineConfig({
  build: {
    outDir: 'dist-state-driver', // Separate output directory for the state driver SDK
    lib: {
      entry: './src/index.ts', // Dedicated entry point for the state driver
      name: 'GBISearchStateDriver',
      formats: ['umd', 'es'], // Build in UMD and ESM formats
      fileName: (format) => `gbi-search-state-driver.${format}.js`,
    },
    rollupOptions: {
      // Specify external dependencies if any (e.g., if we decide to externalize RxJS or Effector)
      external: [],
      output: {
        globals: {
          // Map external dependencies to their global names if needed
        },
      },
    },
  },
  plugins: [
    // Generate TypeScript declaration files
    dts({
      outDir: 'dist-state-driver/types',
      entryRoot: 'src'
    })
  ],
});
