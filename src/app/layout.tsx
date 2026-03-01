import type { Metadata } from "next";
import { Suspense } from "react";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";
import { Subheader } from "@/components/Subheader";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Footer } from "@/components/Footer";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Winzen — Virtual Prediction Markets",
  description: "Free yes/no and multiple choice prediction markets with virtual coins.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrains.variable} font-display antialiased`}>
      <head>
        {/* Apply saved theme before React hydrates — prevents flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t);})();` }} />
      </head>
      <body>
        <Providers>
          <Header />
          <Suspense fallback={null}>
            <Subheader />
          </Suspense>
          <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
          <Footer />
          <ActivityFeed />
        </Providers>
      </body>
    </html>
  );
}
