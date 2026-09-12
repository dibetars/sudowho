import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-white text-sm">
            ⌁
          </span>
          sudowho
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted sm:flex">
          <Link href="/#features" className="hover:text-foreground transition-colors">Features</Link>
          <Link href="/docs" className="hover:text-foreground transition-colors">Docs</Link>
          <Link href="/install" className="hover:text-foreground transition-colors">Install</Link>
          <a
            href="https://github.com/dibetars/sudowho"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors"
          >
            GitHub
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href="/install"
            className="hidden rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-2 transition-colors sm:block"
          >
            Get started
          </a>
        </div>
      </div>
    </header>
  );
}
