import Link from "next/link";

/** Header nav item. Shared by the static shell and the client auth sliver. */
export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="whitespace-nowrap px-2.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:px-3"
    >
      {children}
    </Link>
  );
}
