import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { StoreSelectionGate } from "../components/StoreSelectionGate";
import { BusinessAccountProvider } from "../lib/business-account";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Proven Power",
  description: "Manage your John Deere equipment, service, and parts with Proven Power.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <BusinessAccountProvider>
          <StoreSelectionGate />
          {children}
        </BusinessAccountProvider>
      </body>
    </html>
  );
}
