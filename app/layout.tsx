import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BSVG · Verwaltung",
  description: "Inhalte für eine Schule. Zwei Standorte. Ein gemeinsames CMS.",
  icons: {
    icon: { url: "/favicon.svg?v=2", type: "image/svg+xml" },
    shortcut: "/favicon.svg?v=2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}

