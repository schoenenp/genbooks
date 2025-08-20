
import { HydrateClient } from "@/trpc/server";
import StartConfig from "./_components/start-config";
import Navigation from "./_components/navigation";

export default async function Home(
){

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center bg-gradient-to-b gap-12 from-pirrot-blue-50 to-pirrot-blue-200 text-info-900">
        <Navigation />
        <StartConfig />
      </main>
    </HydrateClient>
  );
}
