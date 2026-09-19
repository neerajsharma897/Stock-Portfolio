import type { MetadataRoute } from "next"

/** Lets phones install the app from the browser ("Add to Home screen" or "Install app"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Family Portfolio",
    short_name: "Portfolio",
    description:
      "The family's stocks, mutual funds, crypto and more in one place.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0d0d0d",
    theme_color: "#3f5bd9",
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
