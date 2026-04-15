import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAS — Memecoin Automation Swarm",
  description:
    "Blue-team research platform for clone token detection across Solana, Base, and BNB chains.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#0a0a0a] text-[#f5f5f5]">
        {children}
      </body>
    </html>
  );
}
