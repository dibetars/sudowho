export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-10 text-sm text-muted sm:flex-row sm:justify-between">
        <div>© {new Date().getFullYear()} sudowho — MIT licensed, runs on your machine.</div>
        <div className="flex gap-6">
          <a href="https://github.com/dibetars/sudowho" target="_blank" rel="noreferrer" className="hover:text-foreground">GitHub</a>
          <a href="/docs" className="hover:text-foreground">Docs</a>
          <a href="/install" className="hover:text-foreground">Install</a>
        </div>
      </div>
    </footer>
  );
}
