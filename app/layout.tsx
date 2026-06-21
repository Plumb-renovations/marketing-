import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono, Fraunces, Nunito } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-data" });
const fraunces = Fraunces({ subsets: ["latin"], weight: ["600"], variable: "--font-serif" });
const nunito = Nunito({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--font-nunito" });

export const metadata: Metadata = {
  title: "Hazel",
  description: "Hazel — marketing command centre for Plumb Renovations.",
  appleWebApp: { capable: true, title: "Hazel", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#1f1a16",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${fraunces.variable} ${nunito.variable}`}
    >
      <body className="font-body min-h-screen bg-slate-950 text-slate-200">{children}</body>
    </html>
  );
}
