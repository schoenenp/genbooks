"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { api } from "@/trpc/react";
import LoadingSpinner from "@/app/_components/loading-spinner";

type TemplateCampaignEntryProps = {
  token?: string;
};

export default function TemplateCampaignEntry({
  token,
}: TemplateCampaignEntryProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [promoCode, setPromoCode] = useState("");
  const [email, setEmail] = useState(session?.user?.email ?? "");

  const {
    data: campaignData,
    isLoading,
    isError,
    error,
  } = api.sponsor.getCampaignTemplate.useQuery(
    {
      token: token ?? "",
    },
    {
      enabled: Boolean(token),
      retry: false,
    },
  );

  const redeemCampaign = api.sponsor.redeemCampaign.useMutation({
    onSuccess: (data) => {
      router.push(
        `/config?bookId=${encodeURIComponent(data.bookId)}&st=${encodeURIComponent(data.sponsorCheckoutToken)}`,
      );
    },
  });

  const moduleCount = useMemo(
    () => campaignData?.template.modules.length ?? 0,
    [campaignData?.template.modules.length],
  );

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const canSubmit =
    promoCode.trim().length >= 6 &&
    isValidEmail(email) &&
    !redeemCampaign.isPending;

  if (!token) {
    return (
      <section className="bg-pirrot-red-100 border-pirrot-red-300 w-full max-w-2xl rounded border p-6">
        <h2 className="text-2xl font-bold">Ungültiger Sponsoring-Link</h2>
        <p className="mt-2">Der Link enthält kein gültiges Kampagnen-Token.</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="flex w-full max-w-2xl items-center justify-center rounded border border-white/30 bg-white/40 p-10">
        <LoadingSpinner />
      </section>
    );
  }

  if (isError || !campaignData) {
    return (
      <section className="bg-pirrot-red-100 border-pirrot-red-300 w-full max-w-2xl rounded border p-6">
        <h2 className="text-2xl font-bold">Kampagne nicht verfügbar</h2>
        <p className="mt-2">
          {error?.message ?? "Die Kampagne konnte nicht geladen werden."}
        </p>
      </section>
    );
  }

  return (
    <section className="w-full max-w-2xl rounded border border-white/30 bg-white/40 p-6">
      <h1 className="text-3xl font-black uppercase">
        Gesponserte Vorlage aktivieren
      </h1>
      <p className="mt-3">
        Geben Sie den Promo-Code ein, um die gesponserte Vorlage freizuschalten.
      </p>

      <div className="border-pirrot-blue-300/30 bg-pirrot-blue-50/60 mt-6 rounded border p-4">
        <h2 className="text-xl font-bold">
          {campaignData.template.name ?? "Gesponserter Planer"}
        </h2>
        <p className="mt-1 text-sm">
          Module in der Basisvorlage: <b>{moduleCount}</b>
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <label htmlFor="promoCode" className="font-semibold">
          Promo-Code
        </label>
        <input
          id="promoCode"
          type="text"
          value={promoCode}
          onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
          className="border-pirrot-blue-300/40 w-full rounded border bg-white p-3"
          placeholder="z. B. SP-AB12CD34"
        />
        <button
          type="button"
          disabled={!canSubmit}
          className="bg-pirrot-blue-500 hover:bg-pirrot-blue-600 rounded p-3 font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {redeemCampaign.isPending
            ? "Aktivierung läuft..."
            : "Vorlage freischalten"}
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <label htmlFor="email" className="font-semibold">
          E-Mail-Adresse {session ? "(angemeldet)" : ""}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={!!session?.user?.email}
          className="border-pirrot-blue-300/40 w-full rounded border bg-white p-3 disabled:bg-gray-100 disabled:text-gray-500"
          placeholder="ihre@email.at"
        />
        {session?.user?.email && (
          <p className="text-sm text-gray-600">
            Sie sind angemeldet als {session.user.email}
          </p>
        )}
      </div>

      {redeemCampaign.error && (
        <p className="border-pirrot-red-200 bg-pirrot-red-50 text-pirrot-red-500 mt-4 rounded border p-3 text-sm">
          {redeemCampaign.error.message}
        </p>
      )}
    </section>
  );
}
