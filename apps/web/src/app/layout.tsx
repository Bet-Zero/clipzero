import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClipZero",
  description: "Fast NBA clip filtering. Zero clutter.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
