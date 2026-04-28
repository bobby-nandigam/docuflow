import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocuFlow — AI Document Intelligence Platform",
  description: "Enterprise AI-native document intelligence. Search, analyze, and automate your entire document ecosystem.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
