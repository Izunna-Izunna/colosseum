import type { Metadata, Viewport } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0612",
};

export const metadata: Metadata = {
  title: "Colosseum — Enter the Arena. Every rep is a hit.",
  description:
    "Challenge your friends to a live pull-up duel. Webcam tracks your reps in real-time. Every pull-up damages your opponent. First to zero loses. Enter the Arena.",
  keywords: ["pull-ups", "fitness", "duel", "webcam", "challenge", "competition"],
  openGraph: {
    title: "Colosseum — Enter the Arena",
    description: "Live webcam pull-up duels. Every rep is a hit.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
