import Link from "next/link";

function Cmd({ children }: { children: string }) {
  return (
    <div className="my-2 rounded-lg border border-border bg-panel-2 px-4 py-2.5 font-mono text-sm text-foreground overflow-x-auto">
      {children}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-14 scroll-mt-24">
      <h2 className="mb-4 text-2xl font-bold tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

const TOC = [
  ["setup", "Setup"],
  ["identity", "Identity switching"],
  ["projects", "Projects & compute"],
  ["heartbeat", "Heartbeat"],
  ["activity", "Git activity"],
  ["env", "Env vault"],
  ["dashboard", "Dashboard"],
  ["config", "Config file"],
] as const;

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="mb-2 text-4xl font-bold tracking-tight">Docs</h1>
      <p className="mb-10 text-muted">Everything sudowho can do, command by command.</p>

      <div className="grid gap-10 lg:grid-cols-[200px_1fr]">
        <nav className="hidden lg:block">
          <div className="sticky top-24 space-y-1 text-sm">
            {TOC.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block rounded-md px-2 py-1.5 text-muted hover:bg-panel-2 hover:text-foreground">
                {label}
              </a>
            ))}
          </div>
        </nav>

        <div>
          <Section id="setup" title="Setup">
            <p>Install once (see the <Link href="/install" className="text-accent-2 underline">install page</Link>), then run the wizard:</p>
            <Cmd>sudowho init</Cmd>
            <p>
              This creates <code>~/.config/sudowho/config.json</code> and walks you
              through your git/GitHub/Vercel profiles. You can also edit the file
              directly — see the <a href="#config" className="text-accent-2 underline">config reference</a> below.
            </p>
          </Section>

          <Section id="identity" title="Identity switching">
            <p>Switch git, GitHub CLI, and Vercel identity for the current repo:</p>
            <Cmd>sudowho work</Cmd>
            <p>Switch and auto-generate a detailed commit message from your staged diff, then push:</p>
            <Cmd>sudowho work --push</Cmd>
            <p>Or provide your own commit message:</p>
            <Cmd>{`sudowho work -m "fix: correct pagination bug"`}</Cmd>
            <p>Other identity commands:</p>
            <Cmd>sudowho status</Cmd>
            <Cmd>sudowho list</Cmd>
            <Cmd>sudowho vercel-save work</Cmd>
          </Section>

          <Section id="projects" title="Projects & compute">
            <p>List everything you've registered, and check live Supabase status:</p>
            <Cmd>sudowho projects</Cmd>
            <Cmd>sudowho accounts</Cmd>
            <Cmd>sudowho compute-status</Cmd>
            <p>Wake the project you need (optionally pausing everything else marked idle-pausable), or pause everything idle:</p>
            <Cmd>sudowho wake my-app --pause-others</Cmd>
            <Cmd>sudowho wake-all</Cmd>
            <Cmd>sudowho pause my-app</Cmd>
            <Cmd>sudowho pause-idle</Cmd>
            <p>Save a Supabase Management API token for an account (only stored locally, chmod 600):</p>
            <Cmd>sudowho supabase-login acme-inc sbp_xxx</Cmd>
          </Section>

          <Section id="heartbeat" title="Heartbeat">
            <p>
              Supabase free-tier projects auto-pause after ~7 days of inactivity.
              sudowho can ping your database directly so that never happens by
              surprise, and tell you how many days you have left:
            </p>
            <Cmd>sudowho heartbeat</Cmd>
            <Cmd>sudowho heartbeat-status</Cmd>
            <p>Automate it daily with a cron/LaunchAgent-style install (macOS):</p>
            <Cmd>sudowho heartbeat-cron-install</Cmd>
          </Section>

          <Section id="activity" title="Git activity">
            <p>
              See the last known push per project — branch, timestamp, days since,
              ahead/behind counts, and dirty state — across every account you manage:
            </p>
            <Cmd>sudowho last-push</Cmd>
            <p>Fetch remotes first for fresher data:</p>
            <Cmd>sudowho last-push --fetch</Cmd>
          </Section>

          <Section id="env" title="Env vault">
            <p>Store and retrieve a per-project <code>.env</code> file, locally, chmod 600:</p>
            <Cmd>sudowho env-set my-app ./path/to/.env</Cmd>
            <Cmd>sudowho env my-app</Cmd>
            <Cmd>sudowho env-to my-app ./apps/my-app/.env</Cmd>
          </Section>

          <Section id="dashboard" title="Dashboard">
            <p>Prefer clicking buttons? Open the local web UI:</p>
            <Cmd>sudowho dashboard</Cmd>
            <p>
              It runs a tiny HTTP server bound to <code>127.0.0.1</code> only, serves
              a small dashboard, and wires every button to the same functions the
              CLI uses. Supports light and dark themes — toggle in the sidebar.
            </p>
          </Section>

          <Section id="config" title="Config file">
            <p>
              Everything lives under <code>~/.config/sudowho/</code>. See the{" "}
              <a
                href="https://github.com/dibetars/sudowho/blob/main/cli/config.example.json"
                target="_blank"
                rel="noreferrer"
                className="text-accent-2 underline"
              >
                example config
              </a>{" "}
              on GitHub for the full shape (profiles, Supabase accounts, projects, settings).
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
