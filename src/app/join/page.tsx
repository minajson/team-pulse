import Link from "next/link";
import { JoinCodeEntry } from "@/components/participant/JoinCodeEntry";
import { Tagline, Wordmark } from "@/components/ui/Wordmark";
import { PulseField } from "@/components/visual/PulseField";

export const metadata = { title: "Join — Team Pulse" };

export default function JoinPage() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <PulseField className="opacity-60" density={22} />

      <div className="relative mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-10">
        <Link href="/" className="self-start rounded-lg">
          <Wordmark size="sm" />
        </Link>

        <div className="flex flex-1 flex-col justify-center pb-16">
          <h1 className="display-tight text-[clamp(2.4rem,11vw,3.5rem)]">
            Enter the
            <br />
            room code
          </h1>
          <Tagline className="mt-4 block text-lg" />
          <JoinCodeEntry className="mt-10" />
        </div>
      </div>
    </main>
  );
}
