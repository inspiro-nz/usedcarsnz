/** Formatting helpers. Every number on the site renders through these. */

export function nzd(value: number | null | undefined, poa = false): string {
  if (poa) return "POA";
  if (value == null) return "—";
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function km(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("en-NZ").format(value)} km`;
}

export function dateNZ(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

export function timeNZ(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** Seconds -> instrument readout: 40s · 4m 10s · 2h 6m · 3d 1h */
export function duration(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export function listingTitle(l: {
  title: string | null;
  year: number;
  make: string;
  model: string;
}): string {
  return l.title ?? `${l.year} ${l.make} ${l.model}`;
}

export function listingPath(l: {
  id: string;
  make: string;
  model: string;
  year: number;
}): string {
  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `/cars/${slug(l.make)}/${slug(l.model)}/${l.year}/${l.id}`;
}
