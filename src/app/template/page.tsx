import Navigation from "@/app/_components/navigation";
import { HydrateClient } from "@/trpc/server";
import TemplateCampaignEntry from "./_components/template-campaign-entry";

export default async function SponsoredTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;

  return (
    <HydrateClient>
      <main className="from-pirrot-blue-50 to-pirrot-blue-100 text-info-900 flex min-h-screen flex-col items-center gap-10 bg-gradient-to-b">
        <Navigation />
        <div className="flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-10">
          <TemplateCampaignEntry token={t} />
        </div>
      </main>
    </HydrateClient>
  );
}

