import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tuttle OS",
  description: "Practice management for Tuttle Law Firm / Crash Guy Injury Attorneys",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="parchment" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('tuttle-theme');if(t==='midnight'||t==='parchment')document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          }}
        />
      </head>
      <body className={`${sourceSans.variable} font-sans`}>{children}</body>
    </html>
  );
}
