import {
  MarketplaceHeader,
  MarketplaceFooter,
} from "@/components/marketplace/chrome";

/**
 * Layout for every marketplace route (/cars, /dealer, /admin, /sign-in,
 * /sign-up, /register-dealer). A route group, so URLs are unaffected and the
 * homepage — which composes its own Navbar/Footer inside app/page.tsx — is
 * untouched. The slate-50 canvas keeps white cards legible, matching how the
 * landing page alternates white and tinted sections.
 */
export default function MarketplaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <MarketplaceHeader />
      <div className="flex-1">{children}</div>
      <MarketplaceFooter />
    </div>
  );
}
