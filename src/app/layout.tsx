import "@/styles/globals.css";

import { type Metadata } from "next";
import { Baloo_2, Cairo } from "next/font/google";

const baloo = Baloo_2({ subsets: ["latin"], variable: "--font-baloo" });
const cairo = Cairo({ subsets: ["latin"], variable: "--font-cairo" });

import { TRPCReactProvider } from "@/trpc/react";

export const metadata: Metadata = {
  title: "Planer Generator",
  description: "",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${baloo.variable} ${cairo.variable}`}>
      <body>
        <TRPCReactProvider>
          <div id="modal-hook"></div>
          {children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
