import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getResumeData } from "@/lib/resume";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateMetadata(): Metadata {
  try {
    const resume = getResumeData();
    return {
      title: `AI CV Query | ${resume.name}`,
      description: `Ask questions about ${resume.name}'s resume and job history.`,
    };
  } catch {
    return {
      title: "AI CV Query",
      description: "Ask questions about a resume and job history.",
    };
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
