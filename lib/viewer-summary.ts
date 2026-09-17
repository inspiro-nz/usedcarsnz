/**
 * The minimum the marketplace header needs to know about the viewer — nothing
 * more. Served by GET /api/viewer and consumed by the client-side auth sliver
 * (components/marketplace/header-auth-nav.tsx). Deliberately carries no ids,
 * names or emails: it is a nav-shape hint, not a profile.
 */
export interface ViewerSummary {
  signedIn: boolean;
  isDealer: boolean;
  isAdmin: boolean;
}

export const SIGNED_OUT: ViewerSummary = {
  signedIn: false,
  isDealer: false,
  isAdmin: false,
};
