import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adversus Lead Tracker",
  description: "Find and track leads for Adversus outbound dialing",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
