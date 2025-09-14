import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.js";
import fs from "fs";

export default defineConfig({
  plugins: [
    crx({ manifest }),

    // This custom plugin will find and copy the pdf.worker.js file for you
    {
      name: "copy-pdf-worker",
      generateBundle() {
        const workerFilePath = "node_modules/pdfjs-dist/build/pdf.worker.mjs";
        if (fs.existsSync(workerFilePath)) {
          this.emitFile({
            type: "asset",
            fileName: "pdf.worker.js",
            source: fs.readFileSync(workerFilePath, "utf-8"),
          });
        } else {
          throw new Error(
            `Could not find ${workerFilePath}. Please run 'npm install'.`
          );
        }
      },
    },
  ],
  build: {
    outDir: "dist",
    minify: false,
    rollupOptions: {
      // Don't split chunks for Chrome extensions
      output: {
        manualChunks: undefined,
      },
    },
  },
  define: {
    // Define import.meta.env for content scripts
    "import.meta.env.MODE": JSON.stringify(
      process.env.NODE_ENV || "production"
    ),
    "import.meta.env.PROD": JSON.stringify(
      process.env.NODE_ENV === "production"
    ),
    "import.meta.env.DEV": JSON.stringify(
      process.env.NODE_ENV !== "production"
    ),
  },
});
