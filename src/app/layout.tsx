import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";

import "./globals.css";

const logoFont = Montserrat({
  subsets: ["latin"],
  weight: "800",
  variable: "--font-logo"
});

export const metadata: Metadata = {
  title: "Plexster",
  description: "Play a Hitster-style music guessing game with your Plex playlists."
};

export const viewport: Viewport = {
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={logoFont.variable} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
