import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BSVG · CMS Werkstatt",
  description: "Inhalte für eine Schule. Zwei Standorte. Ein gemeinsames CMS.",
  icons: {
    icon: "/bsvg-logo.svg",
    shortcut: "/bsvg-logo.svg",
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

