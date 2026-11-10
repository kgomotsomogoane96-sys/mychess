import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MYCHESS — Your games. Your next level.", template: "%s · MYCHESS" },
  description: "Your personal chess lab. Stockfish analyzes your games and explains the ideas in plain English, with interactive lessons built from your own moves.",
  applicationName: "MYCHESS",
  appleWebApp: { capable: true, title: "MYCHESS", statusBarStyle: "black-translucent" },
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }] },
};

export const viewport: Viewport = { themeColor: "#63f45b", colorScheme: "dark", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><Shell>{children}</Shell></body></html>;
}
