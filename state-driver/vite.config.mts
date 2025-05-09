import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts'; // so customers can get proper type definitions
import tsconfigPaths from 'vite-tsconfig-paths';

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
    }),
    tsconfigPaths()
  ],
  resolve: {
    preserveSymlinks: true
  }
});
