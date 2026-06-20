import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-data" });
const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Hazel",
  description: "Hazel — marketing command centre for Plumb Renovations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${fraunces.variable}`}>
      <body className="font-body min-h-screen bg-slate-950 text-slate-200">{children}</body>
    </html>
  );
}
