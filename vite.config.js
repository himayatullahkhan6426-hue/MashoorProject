
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
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-512-maskable.png",
      ],

      manifest: {
        name: "Miss Noori Cosmetics Management",
        short_name: "Miss Noori",
        description: "Cosmetics Shop Management Software",

        theme_color: "#db2777",
        background_color: "#fff1f7",

        display: "standalone",
        orientation: "any",

        start_url: "/",
        scope: "/",

        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
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
