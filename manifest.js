import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "AI Optimizer Suite",
  version: "1.0.0",
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
  },
  description:
    "Enhance ChatGPT with vector-based memory and smart file processing.",
  permissions: ["storage"],
  host_permissions: ["https://chat.openai.com/*", "https://chatgpt.com/*"],
  background: {
    service_worker: "src/background.js",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["https://chat.openai.com/*", "https://chatgpt.com/*"],
      js: ["src/content.js"],
      // Remove the CSS reference - it will be imported directly in content.js
    },
  ],
  web_accessible_resources: [
    {
      // This tells Chrome that the ChatGPT website is allowed to load this worker script
      resources: ["pdf.worker.js"],
      matches: ["https://chat.openai.com/*"],
    },
  ],
});
