
import { HydrateClient } from "@/trpc/server";
import StartConfig from "./_components/start-config";
import Navigation from "./_components/navigation";

export default async function Home(
){

  return (
    <HydrateClient>
      <main className="relative flex min-h-screen flex-col items-center gap-12 overflow-hidden text-info-900">
        <div className="subtle-grid pointer-events-none absolute inset-0 opacity-40" />
        <Navigation />
        <StartConfig />
      </main>
    </HydrateClient>
  );
}
