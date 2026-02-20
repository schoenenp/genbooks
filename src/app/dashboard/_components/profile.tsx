"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/trpc/react";
import LoadingSpinner from "@/app/_components/loading-spinner";
import { ClipboardCopyIcon } from "lucide-react";
import { DashboardSkeleton } from "./dashboard-states";

const CONNECT_COUNTRY_OPTIONS = [
  { code: "AT", label: "Oesterreich (AT)" },
  { code: "DE", label: "Deutschland (DE)" },
  { code: "CH", label: "Schweiz (CH)" },
  { code: "IT", label: "Italien (IT)" },
  { code: "FR", label: "Frankreich (FR)" },
  { code: "NL", label: "Niederlande (NL)" },
  { code: "BE", label: "Belgien (BE)" },
  { code: "LU", label: "Luxemburg (LU)" },
  { code: "ES", label: "Spanien (ES)" },
  { code: "PT", label: "Portugal (PT)" },
  { code: "IE", label: "Irland (IE)" },
  { code: "GB", label: "Vereinigtes Königreich (GB)" },
  { code: "US", label: "USA (US)" },
] as const;

const CONNECT_COUNTRY_CODE_SET: ReadonlySet<string> = new Set(
  CONNECT_COUNTRY_OPTIONS.map((option) => option.code),
);

const DEFAULT_CAMPAIGN_MAX_REDEMPTIONS = "10";
const DEFAULT_CAMPAIGN_VALID_DAYS = "90";

type CampaignEditState = {
  maxRedemptions: string;
  validForDays: string;
};

type CampaignUpdateNotice = {
  variant: "rotated" | "updated";
  message: string;
  token?: string;
};

function inferConnectCountryFromBrowser(): string {
  if (typeof navigator === "undefined") {
    return "AT";
  }

  const candidates = [navigator.language, ...navigator.languages];
  for (const locale of candidates) {
    const normalized = locale.replace(/_/g, "-");
    const parts = normalized.split("-");
    for (const part of parts) {
      const upper = part.toUpperCase();
      if (/^[A-Z]{2}$/.test(upper) && CONNECT_COUNTRY_CODE_SET.has(upper)) {
        return upper;
      }
    }
  }

  return "AT";
}

function formatUnixDate(unix?: number): string {
  if (!unix) {
    return "Unbegrenzt";
  }
  return new Date(unix * 1000).toLocaleDateString("de-DE");
}

function inferValidDaysFromExpiresAt(expiresAt?: number): string {
  if (!expiresAt) {
    return DEFAULT_CAMPAIGN_VALID_DAYS;
  }
  const diffMs = expiresAt * 1000 - Date.now();
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  return String(Math.max(diffDays, 1));
}

type SessionUser = {
  id?: string | undefined;
  name?: string | null | undefined;
  email?: string | null | undefined;
  image?: string | null | undefined;
};

export default function ProfileSection(user: SessionUser) {
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [customPromoCode, setCustomPromoCode] = useState("");
  const [campaignMaxRedemptions, setCampaignMaxRedemptions] = useState(
    DEFAULT_CAMPAIGN_MAX_REDEMPTIONS,
  );
  const [campaignValidDays, setCampaignValidDays] = useState(
    DEFAULT_CAMPAIGN_VALID_DAYS,
  );
  const [connectCountry, setConnectCountry] = useState("AT");
  const [campaignEdits, setCampaignEdits] = useState<
    Record<string, CampaignEditState>
  >({});
  const [campaignUpdateNotice, setCampaignUpdateNotice] =
    useState<CampaignUpdateNotice | null>(null);
  const [campaignLinkCopyFeedback, setCampaignLinkCopyFeedback] = useState("");
  const [copyingCampaignId, setCopyingCampaignId] = useState<string | null>(
    null,
  );
  const searchParams = useSearchParams();
  const utils = api.useUtils();

  const sponsorStatus = api.sponsor.getStatus.useQuery();
  const userBooks = api.book.getUserBooks.useQuery(undefined, {
    enabled: sponsorStatus.data?.onboardingComplete === true,
  });
  const campaigns = api.sponsor.listCampaigns.useQuery(undefined, {
    enabled: sponsorStatus.data?.onboardingComplete === true,
  });
  const salesOverview = api.sponsor.getSalesOverview.useQuery(undefined, {
    enabled: sponsorStatus.data?.onboardingComplete === true,
  });

  const startOnboarding = api.sponsor.startConnectOnboarding.useMutation({
    onSuccess: (data) => {
      window.location.href = data.onboardingUrl;
    },
  });

  const finalizeOnboarding = api.sponsor.finalizeConnectOnboarding.useMutation({
    onSuccess: async () => {
      await utils.sponsor.getStatus.invalidate();
      await utils.user.getMyRole.invalidate();
      await utils.sponsor.listCampaigns.invalidate();
      await utils.sponsor.getSalesOverview.invalidate();
    },
  });

  const createCampaign = api.sponsor.createCampaign.useMutation({
    onSuccess: async () => {
      await utils.sponsor.listCampaigns.invalidate();
      await utils.sponsor.getSalesOverview.invalidate();
      setCustomPromoCode("");
      setCampaignMaxRedemptions(DEFAULT_CAMPAIGN_MAX_REDEMPTIONS);
      setCampaignValidDays(DEFAULT_CAMPAIGN_VALID_DAYS);
    },
  });

  const updateCampaign = api.sponsor.updateCampaign.useMutation({
    onMutate: () => {
      setCampaignUpdateNotice(null);
      setCampaignLinkCopyFeedback("");
    },
    onSuccess: async (data, variables) => {
      await utils.sponsor.listCampaigns.invalidate();
      await utils.sponsor.getSalesOverview.invalidate();
      const isRotatedCampaign = data.id !== variables.campaignId;
      setCampaignUpdateNotice(
        isRotatedCampaign
          ? {
              variant: "rotated",
              message:
                "Kampagne wurde mit neuen Limits neu erstellt. Bitte den neuen Link verwenden.",
              token: data.token,
            }
          : {
              variant: "updated",
              message: "Kampagnen-Einstellungen wurden gespeichert.",
            },
      );
    },
  });

  useEffect(() => {
    setConnectCountry(inferConnectCountryFromBrowser());
  }, []);

  useEffect(() => {
    const hasReturned =
      searchParams.get("sponsor_return") === "1" ||
      searchParams.get("sponsor_refresh") === "1";

    if (hasReturned && !finalizeOnboarding.isPending) {
      finalizeOnboarding.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!campaigns.data) {
      return;
    }

    setCampaignEdits((prev) => {
      const next = { ...prev };
      for (const campaign of campaigns.data) {
        next[campaign.id] ??= {
          maxRedemptions: String(campaign.maxRedemptions ?? 1),
          validForDays: inferValidDaysFromExpiresAt(campaign.expiresAt),
        };
      }
      return next;
    });
  }, [campaigns.data]);

  const templateOptions = useMemo(
    () => (userBooks.data ?? []).filter((book) => Boolean(book.isTemplate)),
    [userBooks.data],
  );

  const setCampaignEditField = (
    campaignId: string,
    field: keyof CampaignEditState,
    value: string,
  ) => {
    setCampaignEdits((prev) => ({
      ...prev,
      [campaignId]: {
        maxRedemptions: prev[campaignId]?.maxRedemptions ?? "1",
        validForDays:
          prev[campaignId]?.validForDays ?? DEFAULT_CAMPAIGN_VALID_DAYS,
        [field]: value,
      },
    }));
  };

  const handleCopyCampaignLink = async (link: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCampaignLinkCopyFeedback("Kopieren nicht unterstützt.");
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      setCampaignLinkCopyFeedback("Neuer Link wurde kopiert.");
    } catch {
      setCampaignLinkCopyFeedback("Link konnte nicht kopiert werden.");
    }
  };

  if (sponsorStatus.isLoading) {
    return (
      <div className="relative flex flex-1 flex-col gap-4 lg:min-h-96">
        <DashboardSkeleton rows={3} />
        <DashboardSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="content-card rise-in relative flex flex-1 flex-col gap-6 p-4 lg:min-h-96">
      <h2 className="text-2xl font-bold uppercase">Profile</h2>

      <ul className="flex flex-col gap-2">
        <li>E-Mail: {user.email}</li>
        <li>Rolle: {sponsorStatus.data?.role ?? "USER"}</li>
        <li>
          Stripe Connect:{" "}
          {sponsorStatus.data?.onboardingComplete
            ? "Verbunden"
            : "Nicht verbunden"}
        </li>
      </ul>

      {!sponsorStatus.data?.onboardingComplete ? (
        <div className="content-card flex flex-col gap-3 p-4">
          <h3 className="text-xl font-bold">Sponsor werden</h3>
          <p className="text-sm">
            Verbinden Sie Ihr Stripe-Konto, um Sponsoring-Kampagnen zu
            erstellen.
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="connect-country" className="text-sm font-semibold">
              Land für Stripe Connect
            </label>
            <select
              id="connect-country"
              value={connectCountry}
              onChange={(event) => setConnectCountry(event.target.value)}
              disabled={
                startOnboarding.isPending || finalizeOnboarding.isPending
              }
              className="field-shell w-fit px-3 py-2 text-sm"
            >
              {CONNECT_COUNTRY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-info-700 text-xs">
              Das Land kann nach Erstellung des Connect-Kontos nicht mehr im
              Dashboard geändert werden.
            </p>
          </div>
          <button
            type="button"
            disabled={startOnboarding.isPending || finalizeOnboarding.isPending}
            onClick={() =>
              startOnboarding.mutate({
                country: connectCountry,
              })
            }
            className="btn-solid w-fit px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {startOnboarding.isPending ? "Weiterleitung..." : "Sponsor werden"}
          </button>
          {startOnboarding.error && (
            <p className="text-pirrot-red-500 text-sm">
              {startOnboarding.error.message}
            </p>
          )}
          {finalizeOnboarding.error && (
            <p className="text-pirrot-red-500 text-sm">
              {finalizeOnboarding.error.message}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="field-shell bg-pirrot-green-100/30 p-4">
            <h3 className="text-xl font-bold">Sponsoring aktiv</h3>
            <p className="text-sm">
              Ihre Vorlagen sind Ihre Produkte. Steuern Sie Ihre Kampagnen
              zentral über Laufzeit, Nutzung und Aktiv-Status.
            </p>
          </div>

          <div className="content-card flex flex-col gap-3 p-4">
            <h3 className="text-xl font-bold">Sales Übersicht</h3>
            {salesOverview.isLoading ? (
              <LoadingSpinner />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="field-shell p-3 text-sm">
                  <p className="text-info-700">Kampagnen</p>
                  <p className="text-2xl font-black">
                    {salesOverview.data?.campaignCount ?? 0}
                  </p>
                  <p className="text-info-700 text-xs">
                    Aktiv: {salesOverview.data?.activeCampaignCount ?? 0}
                  </p>
                </div>
                <div className="field-shell p-3 text-sm">
                  <p className="text-info-700">Einlösungen</p>
                  <p className="text-2xl font-black">
                    {salesOverview.data?.totalRedemptions ?? 0}
                  </p>
                  <p className="text-info-700 text-xs">
                    Offen: {salesOverview.data?.remainingRedemptions ?? 0}
                  </p>
                </div>
                <div className="field-shell p-3 text-sm">
                  <p className="text-info-700">Abgerechnete Sponsoring-Summe</p>
                  <p className="text-2xl font-black">
                    {(
                      (salesOverview.data?.billedSponsorAmountCents ?? 0) / 100
                    ).toFixed(2)}{" "}
                    EUR
                  </p>
                  <p className="text-info-700 text-xs">
                    Rechnungen: {salesOverview.data?.sponsorInvoiceCount ?? 0}
                  </p>
                </div>
              </div>
            )}
            {salesOverview.error && (
              <p className="text-pirrot-red-500 text-sm">
                {salesOverview.error.message}
              </p>
            )}
          </div>

          <div className="content-card flex flex-col gap-3 p-4">
            <h3 className="text-xl font-bold">Kampagne erstellen</h3>
            {userBooks.isLoading ? (
              <LoadingSpinner />
            ) : templateOptions.length === 0 ? (
              <p className="text-sm">
                Keine Vorlagen gefunden. Markieren Sie zuerst einen Planer als
                Vorlage.
              </p>
            ) : (
              <>
                <label htmlFor="templateId" className="text-sm font-semibold">
                  Vorlage
                </label>
                <select
                  id="templateId"
                  value={selectedTemplateId}
                  onChange={(event) =>
                    setSelectedTemplateId(event.target.value)
                  }
                  className="field-shell p-2"
                >
                  <option value="">Bitte auswählen</option>
                  {templateOptions.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.name}
                    </option>
                  ))}
                </select>

                <div className="grid gap-2 md:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="promoCode"
                      className="text-sm font-semibold"
                    >
                      Promo-Code (optional)
                    </label>
                    <input
                      id="promoCode"
                      value={customPromoCode}
                      onChange={(event) =>
                        setCustomPromoCode(event.target.value.toUpperCase())
                      }
                      className="field-shell p-2"
                      placeholder="Automatisch, wenn leer"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="campaign-max-redemptions"
                      className="text-sm font-semibold"
                    >
                      Max. Einlösungen
                    </label>
                    <input
                      id="campaign-max-redemptions"
                      type="number"
                      min={1}
                      max={1000}
                      value={campaignMaxRedemptions}
                      onChange={(event) =>
                        setCampaignMaxRedemptions(event.target.value)
                      }
                      className="field-shell p-2"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="campaign-valid-days"
                      className="text-sm font-semibold"
                    >
                      Laufzeit (Tage)
                    </label>
                    <input
                      id="campaign-valid-days"
                      type="number"
                      min={1}
                      max={365}
                      value={campaignValidDays}
                      onChange={(event) =>
                        setCampaignValidDays(event.target.value)
                      }
                      className="field-shell p-2"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!selectedTemplateId || createCampaign.isPending}
                  onClick={() =>
                    createCampaign.mutate({
                      templateId: selectedTemplateId,
                      promoCode: customPromoCode || undefined,
                      maxRedemptions:
                        Number.parseInt(campaignMaxRedemptions, 10) || 1,
                      validForDays: Number.parseInt(campaignValidDays, 10) || 1,
                    })
                  }
                  className="btn-solid w-fit px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createCampaign.isPending
                    ? "Erstelle..."
                    : "Kampagne erstellen"}
                </button>
                {createCampaign.error && (
                  <p className="text-pirrot-red-500 text-sm">
                    {createCampaign.error.message}
                  </p>
                )}
              </>
            )}

            {createCampaign.data && (
              <div className="field-shell mt-2 p-3 text-sm">
                <p>
                  <b>Promo-Code:</b> {createCampaign.data.promoCode}
                </p>
                <p>
                  <b>Max. Einlösungen:</b> {createCampaign.data.maxRedemptions}
                </p>
                <p>
                  <b>Ablauf:</b> {formatUnixDate(createCampaign.data.expiresAt)}
                </p>
                <p className="break-all">
                  <b>Link:</b>{" "}
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/template?t=${createCampaign.data.token}`
                    : createCampaign.data.token}
                </p>
              </div>
            )}
          </div>

          <div className="content-card flex flex-col gap-3 p-4">
            <h3 className="text-xl font-bold">Meine Kampagnen</h3>
            {campaignUpdateNotice && (
              <div
                className={`rounded border p-3 text-sm ${
                  campaignUpdateNotice.variant === "rotated"
                    ? "border-pirrot-green-300/50 bg-pirrot-green-100/50"
                    : "border-pirrot-blue-300/50 bg-pirrot-blue-100/50"
                }`}
              >
                <p>
                  <b>
                    {campaignUpdateNotice.variant === "rotated"
                      ? "Hinweis zur Link-Aenderung:"
                      : "Update:"}
                  </b>{" "}
                  {campaignUpdateNotice.message}
                </p>
                {campaignUpdateNotice.token && (
                  <>
                    <p className="mt-2 break-all">
                      <b>Neuer Link:</b>{" "}
                      {typeof window !== "undefined"
                        ? `${window.location.origin}/template?t=${campaignUpdateNotice.token}`
                        : campaignUpdateNotice.token}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const token = campaignUpdateNotice.token;
                        if (!token || typeof window === "undefined") {
                          return;
                        }
                        const nextLink = `${window.location.origin}/template?t=${token}`;
                        void handleCopyCampaignLink(nextLink);
                      }}
                      className="btn-soft mt-2 px-3 py-2"
                    >
                      Link kopieren
                    </button>
                    {campaignLinkCopyFeedback && (
                      <p className="mt-2 text-xs">{campaignLinkCopyFeedback}</p>
                    )}
                  </>
                )}
              </div>
            )}
            {campaigns.isLoading ? (
              <LoadingSpinner />
            ) : campaigns.data && campaigns.data.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {campaigns.data.map((campaign, index) => (
                  <li
                    key={campaign.id}
                    className="field-shell stagger-item p-3 text-sm"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <p>
                      <b>Code:</b> {campaign.code}
                    </p>
                    <p>
                      <b>Status:</b> {campaign.active ? "Aktiv" : "Pausiert"}
                    </p>
                    <p>
                      <b>Einlösungen:</b> {campaign.timesRedeemed} /{" "}
                      {campaign.maxRedemptions ?? "Unbegrenzt"}
                    </p>
                    <p>
                      <b>Ablauf:</b> {formatUnixDate(campaign.expiresAt)}
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          typeof navigator !== "undefined" &&
                          navigator.clipboard
                        ) {
                          try {
                            await navigator.clipboard.writeText(
                              typeof window !== "undefined"
                                ? `${window.location.origin}/template?t=${campaign.token}`
                                : campaign.token,
                            );
                            setCopyingCampaignId(campaign.id);
                            setTimeout(() => setCopyingCampaignId(null), 2000);
                          } catch {
                            // silently fail
                          }
                        }
                      }}
                      className="border-pirrot-blue-300/40 bg-pirrot-blue-50/50 hover:bg-pirrot-blue-100 mt-2 flex w-full items-center gap-2 rounded border p-2 text-left"
                    >
                      <span className="text-pirrot-blue-700 grow font-mono text-sm break-all">
                        {typeof window !== "undefined"
                          ? `${window.location.origin}/template?t=${campaign.token}`
                          : campaign.token}
                      </span>
                      <span className="text-pirrot-blue-600 bg-pirrot-blue-100 shrink-0 rounded p-2 py-4">
                        <ClipboardCopyIcon className="h-5 w-5" />
                      </span>
                    </button>
                    {copyingCampaignId === campaign.id && (
                      <p className="mt-1 text-xs font-medium text-green-600">
                        In die Zwischenablage kopiert
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={updateCampaign.isPending}
                        onClick={() =>
                          updateCampaign.mutate({
                            campaignId: campaign.id,
                            active: !campaign.active,
                          })
                        }
                        className="btn-soft px-3 py-2 disabled:opacity-50"
                      >
                        {campaign.active ? "Pausieren" : "Aktivieren"}
                      </button>
                    </div>

                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold">
                          Max. Einlösungen
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          value={
                            campaignEdits[campaign.id]?.maxRedemptions ??
                            String(campaign.maxRedemptions ?? 1)
                          }
                          onChange={(event) =>
                            setCampaignEditField(
                              campaign.id,
                              "maxRedemptions",
                              event.target.value,
                            )
                          }
                          className="field-shell p-2"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold">
                          Laufzeit (Tage)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={
                            campaignEdits[campaign.id]?.validForDays ??
                            inferValidDaysFromExpiresAt(campaign.expiresAt)
                          }
                          onChange={(event) =>
                            setCampaignEditField(
                              campaign.id,
                              "validForDays",
                              event.target.value,
                            )
                          }
                          className="field-shell p-2"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          disabled={updateCampaign.isPending}
                          onClick={() =>
                            updateCampaign.mutate({
                              campaignId: campaign.id,
                              maxRedemptions:
                                Number.parseInt(
                                  campaignEdits[campaign.id]?.maxRedemptions ??
                                    String(campaign.maxRedemptions ?? 1),
                                  10,
                                ) || 1,
                              validForDays:
                                Number.parseInt(
                                  campaignEdits[campaign.id]?.validForDays ??
                                    inferValidDaysFromExpiresAt(
                                      campaign.expiresAt,
                                    ),
                                  10,
                                ) || 1,
                            })
                          }
                          className="btn-solid w-full px-3 py-2 disabled:opacity-50"
                        >
                          Einstellungen speichern
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm">Noch keine Kampagnen erstellt.</p>
            )}
            {updateCampaign.error && (
              <p className="text-pirrot-red-500 text-sm">
                {updateCampaign.error.message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
