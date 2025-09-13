import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background.js"),
        content: resolve(__dirname, "src/content.js"),
        styles: resolve(__dirname, "src/styles.css"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
    target: "es2020",
    minify: false,
  },
  define: {
    "process.env": {},
  },
  optimizeDeps: {
    exclude: ["@xenova/transformers"],
  },
});
