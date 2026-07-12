// Defence-in-depth noindex for the demo deployment (invariant 8 / §7). The demo
// site sits behind Cloudflare Access, but we also emit X-Robots-Tag: noindex so
// it can never be indexed if Access is ever misconfigured. Gated on the build's
// NEXT_PUBLIC_APP_ENV (the demo CI build sets it to "demo"); prod builds get an
// empty headers() list, so the production response is byte-for-byte unchanged.
// app/robots.ts is a frozen landing path and is deliberately NOT edited — this
// header layer is the sanctioned mechanism instead.
const isDemo = process.env.NEXT_PUBLIC_APP_ENV === "demo";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    if (!isDemo) return [];
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

module.exports = nextConfig;

// Dev-only: hydrates getCloudflareContext() for `next dev`. Guarded to
// development because the helper isn't build-aware — unguarded it also runs
// during `next build`, starting a wrangler remote proxy (the always-remote AI
// binding) that needs Cloudflare auth and breaks credential-less builds (CI,
// fresh clones). `next build`/deploy set NODE_ENV=production and skip it.
if (process.env.NODE_ENV === "development") {
  import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
}
