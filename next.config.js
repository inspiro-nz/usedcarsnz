/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
