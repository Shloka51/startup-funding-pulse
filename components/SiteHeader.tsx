import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
          Funding Pulse
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/" className="rounded-md px-3 py-1.5 text-muted hover:bg-surface-2 hover:text-ink">
            Digest
          </Link>
          <Link href="/settings" className="rounded-md px-3 py-1.5 text-muted hover:bg-surface-2 hover:text-ink">
            Settings
          </Link>
        </nav>
      </div>
    </header>
  );
}
