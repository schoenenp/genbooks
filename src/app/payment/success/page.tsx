
import { HydrateClient } from "@/trpc/server";
import Navigation from "@/app/_components/navigation";
import Link from "next/link";
import Countdown from "@/app/_components/countdown";

export default async function Success({
  searchParams,
}: {
  searchParams: Promise<{ session_id: string }>
}){ 

  const {session_id} = await searchParams
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center bg-gradient-to-b gap-12 from-pirrot-blue-50 to-pirrot-blue-200 text-info-900">
        <Navigation />
        <div className="size-full flex flex-col gap-2 justify-center items-center pt-12">
        <h1 className="text-2xl uppercase font-bold text-pirrot-green-300">Geschafft!</h1>
        <p className="w-full max-w-xl">Der Bezahlvorgang wurde abgeschlossen, ihre Bestellung wird bearbeitet. Sie werden in <Countdown session={session_id} redirect={"/dashboard?view=orders"} /> Sekunden zur <Link className="underline font-semibold" href="/dashboard?view=orders">{" Bestellübersicht "}</Link> oder zum Startbildschirm weitergeleitet. Eine E-Mail für die Bestellung sollte in Ihrem Postfach liegen.</p>
        </div>
      </main>
    </HydrateClient>
  );
}
