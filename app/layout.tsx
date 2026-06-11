import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radius Explorer AI",
  description: "Location intelligence platform — find everything within your radius",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
