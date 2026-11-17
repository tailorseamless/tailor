import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
  // Pages load on first visit, so a library only some pages use (the dialog on Designs, the dropdown menu…)
  // would otherwise be found mid-session. The dev server then re-bundles, answers 504 "outdated optimized
  // dependency" and the page shows "Something went wrong" until a reload. Listing them bundles all of
  // them at startup. Dev only; the production build is unaffected.
  optimizeDeps: {
    include: [
      "react",
      "react/jsx-dev-runtime",
      "react-dom/client",
      "react-router-dom",
      "@tanstack/react-query",
      "axios",
      "react-hook-form",
      "@hookform/resolvers/zod",
      "zod",
      "lucide-react",
      "clsx",
      "tailwind-merge",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "firebase/app",
      "firebase/auth",
      "firebase/messaging",
    ],
  },
  preview: { port: 4173 },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        // Vendor chunks change rarely, so browsers keep them cached across deploys.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query", "axios"],
          firebase: ["firebase/app", "firebase/auth"],
        },
      },
    },
  },
});
