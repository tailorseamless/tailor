import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

/** The values the live site cannot work without. They are compiled into the page, so they must exist at build time. */
const REQUIRED_ON_NETLIFY = [
  "VITE_API_URL",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];

/**
 * Netlify has no client/.env (it is not in git), and a missing VITE_API_URL makes the app quietly call
 * localhost:4000 from every visitor's browser. So a Netlify build with these missing fails, and says why.
 * Local and CI builds are not checked.
 */
function assertNetlifyEnv(mode: string): void {
  if (process.env.NETLIFY !== "true") return;
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const missing = REQUIRED_ON_NETLIFY.filter((key) => !env[key]?.trim());
  const problems = missing.map((key) => `${key} is not set`);
  const api = env.VITE_API_URL?.trim() ?? "";
  if (api && !/^https:\/\//.test(api))
    problems.push("VITE_API_URL must be the API's https:// address, ending in /api/v1");
  if (problems.length > 0) {
    throw new Error(
      `The web app cannot be deployed yet:\n  - ${problems.join("\n  - ")}\n` +
        "Set them in Netlify → Site configuration → Environment variables, then trigger a new deploy.",
    );
  }
}

export default defineConfig(({ command, mode }) => {
  if (command === "build") assertNetlifyEnv(mode);
  return {
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
  };
});
