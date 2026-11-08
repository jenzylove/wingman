import type { Metadata, Viewport } from "next";
import { Unbounded, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import "./globals.css";
import Providers from "@/components/Providers";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { themeBootScript } from "@/components/ThemeToggle";
import { wagmiConfig } from "@/lib/wallet/wagmi";

const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500", "700"] });

const site = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Wingman: ride the call, leave when they leave", template: "%s · Wingman" },
  description:
    "Paste a call and see what the caller and their crew did around the post. Ride it with an exit that sells the moment the crew starts selling. Solana and Base.",
  openGraph: { siteName: "Wingman", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#05070D" },
    { media: "(prefers-color-scheme: light)", color: "#F6F4EE" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const initialState = cookieToInitialState(wagmiConfig, (await headers()).get("cookie"));
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${unbounded.variable} ${jetbrains.variable} min-h-dvh antialiased`}>
        <Providers initialState={initialState}>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-bg">
            Skip to content
          </a>
          <Nav />
          <main id="main">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
