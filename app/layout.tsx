import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://usedcarsnz.co.nz";

// Brand entity for search and answer engines. A bare "UsedCarsNZ" query reads as
// the generic "used cars nz", so the Organization/WebSite markup (with the spaced
// spellings as alternateName) is what ties the brand name to this domain.
const brandJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "UsedCarsNZ",
      alternateName: ["UsedCars NZ", "Used Cars NZ"],
      url: siteUrl,
      areaServed: { "@type": "Country", name: "New Zealand" },
      description:
        "New Zealand used-car co-listing platform for dealers: every buyer enquiry answered in under a minute, qualified, and handed to the dealer.",
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "UsedCarsNZ",
      alternateName: ["UsedCars NZ", "Used Cars NZ"],
      url: siteUrl,
      inLanguage: "en-NZ",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "UsedCarsNZ | Used cars from NZ dealers, every enquiry answered fast",
    template: "%s | UsedCarsNZ",
  },
  description:
    "UsedCarsNZ is a New Zealand used-car platform for dealers. Keep your Trade Me listing and add UsedCarsNZ: every buyer enquiry answered in under a minute, qualified by a labelled AI assistant, approved by you, and measured on a dashboard you can hold us to.",
  applicationName: "UsedCarsNZ",
  openGraph: {
    siteName: "UsedCarsNZ",
    locale: "en_NZ",
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
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(brandJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}