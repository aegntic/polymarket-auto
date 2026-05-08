import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/Providers";
import { WalletErrorBoundary } from "@/components/WalletErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "POLYAGENT - Polymarket Autonomous Trading Dashboard",
  description: "Real-time Polymarket wallet analyzer and autonomous trading agent dashboard. Track edge traders, monitor agent decisions, and analyze market opportunities.",
  keywords: ["Polymarket", "Trading", "Agent", "Dashboard", "Kelly Criterion", "Prediction Markets"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `(function(){var a=[],b=window.ethereum;if(b&&a.push(b),Object.defineProperty(window,"ethereum",{configurable:!0,enumerable:!0,get:function(){return a.length>0?a[0]:b||void 0},set:function(c){c&&"object"==typeof c&&!a.includes(c)&&a.push(c),b||(b=c)}}),b)window.dispatchEvent(new Event("ethereum#initialized"))})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <WalletErrorBoundary>
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </WalletErrorBoundary>
      </body>
    </html>
  );
}
