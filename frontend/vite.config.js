import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

      includeAssets: [
        "favicon.png",
        "icons.svg",
      ],

      manifest: {
        name: "Miss Noori Cosmetics Management",
        short_name: "Miss Noori",
        description: "Cosmetics Shop Management Software",
        theme_color: "#2563eb",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/favicon.png",
            sizes: "any",
            type: "image/png",
          },
          {
            src: "/icons.svg",
            sizes: "any",
            type: "image/svg+xml",
          },
        ],
      },

      workbox: {
        navigateFallback: "index.html",
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,woff2}",
        ],
      },
    }),
  ],
});