import Navigation from "@/app/_components/navigation";
import { auth } from "@/server/auth";
import { HydrateClient } from "@/trpc/server";
import TemplateCampaignEntry from "./_components/template-campaign-entry";

export default async function PartnerTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; claim?: string }>;
}) {
  const { t, claim } = await searchParams;
  const session = await auth();
  const sessionEmail = session?.user?.email;
  const isLoggedIn = Boolean(session?.user);

  return (
    <HydrateClient>
      <main className="from-pirrot-blue-50 to-pirrot-blue-100 text-info-900 flex min-h-screen flex-col items-center gap-10 bg-gradient-to-b">
        <Navigation />
        <div className="flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-10">
          <TemplateCampaignEntry
            token={t}
            claimToken={claim}
            sessionEmail={sessionEmail}
            isLoggedIn={isLoggedIn}
          />
        </div>
      </main>
    </HydrateClient>
  );
}
