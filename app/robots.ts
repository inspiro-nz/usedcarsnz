import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://usedcarsnz.co.nz";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dealer", "/admin"] }],
    sitemap: `${site}/sitemap.xml`,
  };
}
