import type { MetadataRoute } from "next";

// PWA manifest for Hazel (Kennel dark). Next serves this at /manifest.webmanifest
// and auto-links it. Icons are the chocolate app tile (SVG, scalable).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hazel",
    short_name: "Hazel",
    description: "Hazel — marketing command centre.",
    start_url: "/",
    display: "standalone",
    background_color: "#1f1a16",
    theme_color: "#1f1a16",
    icons: [
      { src: "/icons/hazel-512.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/hazel-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
