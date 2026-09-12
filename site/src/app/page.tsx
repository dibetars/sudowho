import Link from "next/link";
import { SignupForm } from "@/components/signup-form";

const USPS = [
  {
    title: "Runs entirely on your machine",
    body: "No account, no server, no telemetry. Your git, GitHub, Vercel, and Supabase credentials never leave your laptop.",
  },
  {
    title: "Zero lock-in",
    body: "Everything is one readable JSON file you own. Back it up, version it, edit it by hand — no proprietary format.",
  },
  {
    title: "No heavy dependencies",
    body: "Pure bash + Python standard library on the CLI, vanilla JS/CSS on the dashboard. Nothing to `npm install` to run it day to day.",
  },
  {
    title: "One command, not four",
    body: "Switching git identity, `gh auth switch`, and Vercel login/scope used to be three manual steps per context switch. Now it's one.",
  },
  {
    title: "Stops surprise Supabase pauses",
    body: "Free-tier projects auto-pause after 7 idle days. sudowho heartbeats your own DB on a schedule and tells you exactly how many days you have left.",
  },
  {
    title: "One table instead of five dashboards",
    body: "See every project's compute status, last git push, and account mapping in one place — instead of five browser tabs across vendors.",
  },
  {
    title: "Built for multi-client work",
    body: "Freelancers and consultants managing several client GitHub/Vercel/Supabase orgs get a single source of truth for which is which.",
  },
  {
    title: "Fully open source",
    body: "MIT licensed. Every line that touches a token is readable — audit it yourself instead of trusting a black box.",
  },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-fade absolute inset-0 -z-10 h-full w-full" />
        <div className="mx-auto max-w-4xl px-6 pb-20 pt-24 text-center sm:pt-32">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            100% local — nothing ever leaves your machine
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            One command to switch{" "}
            <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
              git, GitHub, Vercel & Supabase
            </span>{" "}
            identities
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
            sudowho is a local-first CLI and dashboard for developers juggling multiple
            accounts. Switch identities per repo, wake or pause Supabase compute, and
            track git activity — all from one tool that never phones home.
          </p>

          <div className="mx-auto mt-10 flex flex-col items-center gap-4">
            <div className="rounded-xl border border-border bg-panel px-5 py-3 font-mono text-sm text-foreground">
              curl -fsSL https://sudowho.tarsusstudios.com/install.sh | bash
            </div>
            <div className="flex gap-3">
              <Link
                href="/install"
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-2 transition-colors"
              >
                Install sudowho
              </Link>
              <a
                href="https://github.com/dibetars/sudowho"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border bg-panel px-5 py-2.5 text-sm font-medium text-foreground hover:border-accent-2 transition-colors"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CLI vs dashboard */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-panel p-8">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-accent-2">Terminal</div>
            <h3 className="mb-2 text-xl font-semibold">Use it as a CLI</h3>
            <p className="text-sm text-muted">
              Drop into any repo and run <code className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-xs">sudowho work</code>{" "}
              to switch git, GitHub, and Vercel in one shot — with an optional
              auto-generated commit message and push.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-panel p-8">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-accent-2">Dashboard</div>
            <h3 className="mb-2 text-xl font-semibold">Or a local web dashboard</h3>
            <p className="text-sm text-muted">
              Run <code className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-xs">sudowho dashboard</code> to open a
              local UI with every command wired to a button — compute status,
              heartbeats, and git activity across every project, light or dark mode.
            </p>
          </div>
        </div>
      </section>

      {/* Features / USPs */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-2 text-center text-3xl font-bold tracking-tight">Why sudowho</h2>
        <p className="mx-auto mb-12 max-w-xl text-center text-muted">
          Built by a developer managing 9+ Supabase accounts and multiple GitHub/Vercel
          identities across personal and client work — for anyone in the same boat.
        </p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {USPS.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-panel p-6">
              <h3 className="mb-2 font-semibold">{f.title}</h3>
              <p className="text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Signup */}
      <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <div className="rounded-2xl border border-border bg-panel p-10">
          <h2 className="mb-2 text-2xl font-bold tracking-tight">Get updates</h2>
          <p className="mb-6 text-sm text-muted">
            New releases, providers beyond Supabase, and the desktop app — straight to your inbox. No spam.
          </p>
          <div className="flex justify-center">
            <SignupForm />
          </div>
        </div>
      </section>
    </main>
  );
}
