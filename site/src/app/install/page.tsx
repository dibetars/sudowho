import Link from "next/link";

function Cmd({ children }: { children: string }) {
  return (
    <div className="my-2 rounded-lg border border-border bg-panel-2 px-4 py-2.5 font-mono text-sm text-foreground overflow-x-auto">
      {children}
    </div>
  );
}

export default function InstallPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-2 text-4xl font-bold tracking-tight">Install</h1>
      <p className="mb-10 text-muted">
        sudowho needs only <code>python3</code> and <code>git</code> — both are already
        on macOS and most Linux distros. The <code>gh</code> and <code>vercel</code> CLIs
        are optional; sudowho skips whatever isn&apos;t installed.
      </p>

      <h2 className="mb-3 mt-10 text-xl font-semibold">1. Run the installer</h2>
      <p className="mb-3 text-sm text-muted">This downloads the CLI and dashboard into <code>~/.sudowho</code> and symlinks the binary into <code>~/bin</code>:</p>
      <Cmd>curl -fsSL https://sudowho.tarsusstudios.com/install.sh | bash</Cmd>
      <p className="mt-3 text-sm text-muted">
        If <code>~/bin</code> isn&apos;t already on your <code>PATH</code>, the installer
        will tell you the line to add to your shell profile.
      </p>

      <h2 className="mb-3 mt-10 text-xl font-semibold">2. Run the setup wizard</h2>
      <Cmd>sudowho init</Cmd>
      <p className="mt-3 text-sm text-muted">
        Answer a few prompts for each identity you switch between (git name/email,
        GitHub CLI account, Vercel scope). You can add Supabase accounts and projects
        afterward by editing <code>~/.config/sudowho/config.json</code> — see the{" "}
        <a
          href="https://github.com/dibetars/sudowho/blob/main/cli/config.example.json"
          target="_blank"
          rel="noreferrer"
          className="text-accent-2 underline"
        >
          example config
        </a>.
      </p>

      <h2 className="mb-3 mt-10 text-xl font-semibold">3. Open the dashboard (optional)</h2>
      <Cmd>sudowho dashboard</Cmd>
      <p className="mt-3 text-sm text-muted">
        Opens at <code>http://127.0.0.1:4173</code> by default. Everything runs
        locally; nothing is uploaded anywhere.
      </p>

      <h2 className="mb-3 mt-10 text-xl font-semibold">Manual install</h2>
      <p className="mb-3 text-sm text-muted">Prefer to inspect before running a script? Clone the repo directly:</p>
      <Cmd>git clone https://github.com/dibetars/sudowho.git</Cmd>
      <Cmd>ln -s "$PWD/sudowho/cli/bin/sudowho" ~/bin/sudowho</Cmd>

      <p className="mt-10 text-sm text-muted">
        Full command reference: <Link href="/docs" className="text-accent-2 underline">Docs</Link>
      </p>
    </div>
  );
}
