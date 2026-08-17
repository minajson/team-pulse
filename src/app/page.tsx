import Link from "next/link";
import { CreateSessionButton } from "@/components/home/CreateSessionButton";
import { Wordmark } from "@/components/ui/Wordmark";
import { PulseField } from "@/components/visual/PulseField";
import { ROUNDS } from "@/lib/content/session-plan";

export default function HomePage() {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <PulseField className="opacity-70" density={30} interactive />

      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-6 py-8 sm:px-10 sm:py-12">
        <header className="flex items-center justify-between">
          <Wordmark size="md" />
          <Link
            href="/join"
            className="rounded-full px-4 py-2 text-sm font-semibold text-ink-2 transition hover:bg-ink/6 hover:text-ink"
          >
            Join a session
          </Link>
        </header>

        <div className="flex flex-1 flex-col justify-center py-16">
          <p className="eyebrow text-cobalt">Live team engagement</p>

          <h1 className="display-tight mt-5 text-[clamp(2.8rem,9vw,7.5rem)]">
            What does our
            <br />
            team <span className="serif-accent font-normal text-cobalt">really</span> think?
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-2 sm:text-xl">
            Six rounds that get a hybrid team talking honestly about how they work together —
            collaboration, trust, accountability, and the decisions nobody usually says out loud.
            No accounts. No scores. No right answers.
          </p>

          <div className="mt-11 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <CreateSessionButton />
            <Link
              href="/join"
              className="inline-flex h-14 items-center justify-center rounded-2xl bg-surface px-6 text-base font-semibold text-ink shadow-lift ring-1 ring-ink/12 ring-inset transition hover:bg-paper-2 hover:ring-ink/25"
            >
              I have a room code
            </Link>
          </div>

          <p className="mt-6 text-sm text-ink-3">
            Runs in the room and online at the same time. Participants join by scanning a code —
            nothing to install, nothing to sign up for.
          </p>
        </div>

        <section aria-label="Session structure" className="border-t border-ink/10 pt-8">
          <p className="eyebrow text-ink-3">The session</p>
          <ol className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {ROUNDS.map((round) => (
              <li key={round.id} className="flex gap-4">
                <span className="tnum mt-0.5 text-sm font-bold text-cobalt">
                  {String(round.index).padStart(2, "0")}
                </span>
                <span>
                  <span className="block font-semibold text-ink">{round.title}</span>
                  <span className="block text-sm leading-snug text-ink-3">{round.purpose}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
