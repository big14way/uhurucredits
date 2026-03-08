import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import BottomNav from "./components/BottomNav";
import { ToastProvider } from "./components/Toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Uhuru Credit - Credit for 1 Billion Africans",
  description: "The first on-chain uncollateralized BNPL protocol for Africa",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased bg-gray-950 text-white`}>
        <Providers>
          <ToastProvider>
            <div className="pb-16">{children}</div>
            <BottomNav />
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
