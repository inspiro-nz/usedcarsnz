import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "UsedCarsNZ",
    template: "%s | UsedCarsNZ",
  },
  description:
    "Keep your Trade Me listing and add UsedCarsNZ. Every buyer enquiry answered in under a minute, qualified by a labelled AI assistant, approved by you, and measured on a dashboard you can hold us to.",
  openGraph: {
    title: "UsedCarsNZ Founding Dealer Program",
    description:
      "Every enquiry answered in under a minute, qualified, handed to you warm, and measured. Free two-month pilot for NZ dealerships.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-NZ"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}