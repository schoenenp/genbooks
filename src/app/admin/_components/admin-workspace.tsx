"use client";

import { useCallback, useMemo, useState } from "react";
import { api } from "@/trpc/react";
import LoadingSpinner from "@/app/_components/loading-spinner";

type AdminView =
  | "fulfillment"
  | "stripe"
  | "partnerCodes"
  | "partnerUsers"
  | "sales"
  | "plannerModules";

function formatEuro(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "SUBMITTED_BY_SCHOOL":
      return "Eingereicht";
    case "UNDER_PARTNER_REVIEW":
      return "In Prüfung";
    case "PARTNER_CONFIRMED":
      return "Bestätigt";
    case "PARTNER_DECLINED":
      return "Abgelehnt";
    case "RELEASED_TO_PRODUCTION":
      return "Produktion";
    case "FULFILLED":
      return "Erfüllt";
    default:
      return status;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "SUBMITTED_BY_SCHOOL":
      return "bg-amber-100 text-amber-800";
    case "UNDER_PARTNER_REVIEW":
      return "bg-blue-100 text-blue-800";
    case "PARTNER_CONFIRMED":
      return "bg-emerald-100 text-emerald-800";
    case "PARTNER_DECLINED":
      return "bg-red-100 text-red-800";
    case "RELEASED_TO_PRODUCTION":
      return "bg-purple-100 text-purple-800";
    case "FULFILLED":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function Toast(props: { message: string; type: "success" | "error" }) {
  return (
    <div
      className={`animate-slide-up fixed right-4 bottom-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
        props.type === "success"
          ? "bg-emerald-600 text-white"
          : "bg-red-600 text-white"
      }`}
    >
      {props.message}
    </div>
  );
}

function FeedbackToast() {
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const clearMessage = useCallback(() => {
    setTimeout(() => setMessage(null), 3000);
  }, []);

  return (
    <>
      <MutationFeedbackBridge
        onMessage={(msg) => {
          setMessage(msg);
          clearMessage();
        }}
      />
      {message && <Toast message={message.text} type={message.type} />}
    </>
  );
}

function MutationFeedbackBridge(props: {
  onMessage: (msg: { text: string; type: "success" | "error" }) => void;
}) {
  const utils = api.useUtils();

  api.partner.adjustPartnerOrderAmount.useMutation({
    onSuccess: async () => {
      await utils.partner.listAdminPartnerOrders.invalidate();
      props.onMessage({ text: "Betrag angepasst", type: "success" });
    },
    onError: (err) => {
      props.onMessage({ text: err.message, type: "error" });
    },
  });

  api.partner.adminConfirmPartnerOrder.useMutation({
    onSuccess: async () => {
      await utils.partner.listAdminPartnerOrders.invalidate();
      props.onMessage({ text: "Bestellung bestätigt", type: "success" });
    },
    onError: (err) => {
      props.onMessage({ text: err.message, type: "error" });
    },
  });

  api.partner.adminReleasePartnerOrderToProduction.useMutation({
    onSuccess: async () => {
      await utils.partner.listAdminPartnerOrders.invalidate();
      props.onMessage({ text: "Zur Produktion freigegeben", type: "success" });
    },
    onError: (err) => {
      props.onMessage({ text: err.message, type: "error" });
    },
  });

  api.partner.createAdminStripeCoupon.useMutation({
    onSuccess: async () => {
      await utils.partner.listAdminStripeCoupons.invalidate();
      props.onMessage({ text: "Coupon erstellt", type: "success" });
    },
    onError: (err) => {
      props.onMessage({ text: err.message, type: "error" });
    },
  });

  api.partner.setAdminStripeCouponActive.useMutation({
    onSuccess: async () => {
      await utils.partner.listAdminStripeCoupons.invalidate();
      props.onMessage({ text: "Coupon-Status aktualisiert", type: "success" });
    },
    onError: (err) => {
      props.onMessage({ text: err.message, type: "error" });
    },
  });

  api.partner.setAdminPartnerCodeActive.useMutation({
    onSuccess: async () => {
      await utils.partner.listAdminPartnerCodes.invalidate();
      props.onMessage({ text: "Partner-Code aktualisiert", type: "success" });
    },
    onError: (err) => {
      props.onMessage({ text: err.message, type: "error" });
    },
  });

  api.partner.rotateAdminPartnerCode.useMutation({
    onSuccess: async () => {
      await utils.partner.listAdminPartnerCodes.invalidate();
      props.onMessage({ text: "Code erfolgreich rotiert", type: "success" });
    },
    onError: (err) => {
      props.onMessage({ text: err.message, type: "error" });
    },
  });

  api.partner.setAdminUserRole.useMutation({
    onSuccess: async () => {
      await utils.partner.listAdminUsersOverview.invalidate();
      props.onMessage({ text: "Rolle aktualisiert", type: "success" });
    },
    onError: (err) => {
      props.onMessage({ text: err.message, type: "error" });
    },
  });

  return null;
}

function StripeCouponsPanel() {
  const [code, setCode] = useState("SPRING40");
  const [discountType, setDiscountType] = useState<"PERCENT" | "AMOUNT">(
    "PERCENT",
  );
  const [percentOff, setPercentOff] = useState("40");
  const [amountOff, setAmountOff] = useState("10");
  const [maxRedemptions, setMaxRedemptions] = useState("100");
  const [validForDays, setValidForDays] = useState("90");

  const coupons = api.partner.listAdminStripeCoupons.useQuery(undefined, {
    staleTime: 30000,
  });

  const createCoupon = api.partner.createAdminStripeCoupon.useMutation();
  const setCouponActive = api.partner.setAdminStripeCouponActive.useMutation();

  const handleCreate = () => {
    createCoupon.mutate({
      code,
      maxRedemptions: Number(maxRedemptions),
      validForDays: Number(validForDays),
      discount:
        discountType === "PERCENT"
          ? { type: "PERCENT", percentOff: Number(percentOff) }
          : {
              type: "AMOUNT",
              amountOffCents: Math.round(Number(amountOff) * 100),
            },
    });
    setCode("");
  };

  return (
    <section className="space-y-4">
      <div className="content-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black uppercase">Stripe Coupon Codes</h3>
          <button
            type="button"
            onClick={() => coupons.refetch()}
            className="btn-soft px-3 py-1.5 text-xs"
          >
            Aktualisieren
          </button>
        </div>
        <p className="text-info-700 mt-1 text-xs">
          Eigene Plattform-Coupons für Aktionen und Deals erstellen.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="field-shell px-3 py-2 text-sm"
            placeholder="Code z.B. SUMMER40"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDiscountType("PERCENT")}
              className={`rounded px-3 py-2 text-xs font-semibold ${
                discountType === "PERCENT"
                  ? "bg-pirrot-blue-100 text-pirrot-blue-900"
                  : "bg-white/60"
              }`}
            >
              Prozent
            </button>
            <button
              type="button"
              onClick={() => setDiscountType("AMOUNT")}
              className={`rounded px-3 py-2 text-xs font-semibold ${
                discountType === "AMOUNT"
                  ? "bg-pirrot-blue-100 text-pirrot-blue-900"
                  : "bg-white/60"
              }`}
            >
              Fester Betrag
            </button>
          </div>
          {discountType === "PERCENT" ? (
            <input
              value={percentOff}
              onChange={(e) => setPercentOff(e.target.value)}
              className="field-shell px-3 py-2 text-sm"
              placeholder="Rabatt in %"
            />
          ) : (
            <input
              value={amountOff}
              onChange={(e) => setAmountOff(e.target.value)}
              className="field-shell px-3 py-2 text-sm"
              placeholder="Rabatt in EUR"
            />
          )}
          <input
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            className="field-shell px-3 py-2 text-sm"
            placeholder="Max Einlösungen"
          />
          <input
            value={validForDays}
            onChange={(e) => setValidForDays(e.target.value)}
            className="field-shell px-3 py-2 text-sm"
            placeholder="Gültig für Tage"
          />
        </div>
        <button
          type="button"
          disabled={createCoupon.isPending}
          className="btn-solid mt-3 px-4 py-2 disabled:opacity-60"
          onClick={handleCreate}
        >
          {createCoupon.isPending ? "Erstelle..." : "Coupon erstellen"}
        </button>
      </div>

      <div className="content-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-info-50 text-info-700 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Rabatt</th>
                <th className="px-4 py-3 font-semibold">Einlösungen</th>
                <th className="px-4 py-3 font-semibold">Ablauf</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-info-100 divide-y">
              {coupons.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : coupons.data?.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-info-600 px-4 py-8 text-center"
                  >
                    Keine Coupons vorhanden
                  </td>
                </tr>
              ) : (
                coupons.data!.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-info-50/50">
                    <td className="px-4 py-3 font-medium">{coupon.code}</td>
                    <td className="px-4 py-3">
                      {coupon.coupon.percentOff
                        ? `${coupon.coupon.percentOff}%`
                        : coupon.coupon.amountOff
                          ? formatEuro(coupon.coupon.amountOff)
                          : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {coupon.timesRedeemed}
                      {coupon.maxRedemptions
                        ? ` / ${coupon.maxRedemptions}`
                        : ""}
                    </td>
                    <td className="px-4 py-3">
                      {coupon.expiresAt
                        ? formatDate(new Date(coupon.expiresAt * 1000))
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          coupon.active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-zinc-200 text-zinc-700"
                        }`}
                      >
                        {coupon.active ? "Aktiv" : "Inaktiv"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="btn-soft px-3 py-1.5 text-xs"
                        onClick={() =>
                          setCouponActive.mutate({
                            promotionCodeId: coupon.id,
                            active: !coupon.active,
                          })
                        }
                        disabled={setCouponActive.isPending}
                      >
                        {coupon.active ? "Deaktivieren" : "Aktivieren"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function PartnerCodesPanel() {
  const [activeFilter, setActiveFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    null,
  );
  const [rotateCode, setRotateCode] = useState("");
  const [rotateMaxRedemptions, setRotateMaxRedemptions] = useState("10");
  const [rotateValidForDays, setRotateValidForDays] = useState("90");

  const campaigns = api.partner.listAdminPartnerCodes.useQuery(
    activeFilter === "all" ? undefined : { active: activeFilter === "active" },
    { staleTime: 30000 },
  );

  const setActive = api.partner.setAdminPartnerCodeActive.useMutation();
  const rotate = api.partner.rotateAdminPartnerCode.useMutation();

  const selected = useMemo(
    () =>
      campaigns.data?.find((item) => item.id === selectedCampaignId) ?? null,
    [campaigns.data, selectedCampaignId],
  );

  return (
    <section className="space-y-4">
      <div className="content-card flex items-center justify-between p-4">
        <div>
          <h3 className="text-lg font-black uppercase">Partner Codes</h3>
          <div className="mt-2 flex gap-2">
            {[
              { id: "all", label: "Alle" },
              { id: "active", label: "Aktiv" },
              { id: "inactive", label: "Inaktiv" },
            ].map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setActiveFilter(entry.id as "all" | "active" | "inactive");
                  setSelectedCampaignId(null);
                }}
                className={`rounded px-3 py-1 text-xs font-semibold ${
                  activeFilter === entry.id
                    ? "bg-pirrot-blue-100 text-pirrot-blue-900"
                    : "bg-white/60"
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => campaigns.refetch()}
          className="btn-soft px-3 py-1.5 text-xs"
        >
          Aktualisieren
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr,1fr]">
        <div className="content-card max-h-[600px] overflow-y-auto p-0">
          {campaigns.isLoading ? (
            <div className="p-8 text-center">
              <LoadingSpinner />
            </div>
          ) : campaigns.data?.length === 0 ? (
            <div className="text-info-600 p-8 text-center">
              Keine Partner-Codes vorhanden
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-info-50 text-info-700 sticky top-0 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Partner</th>
                  <th className="px-4 py-3 font-semibold">Redemptions</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-info-100 divide-y">
                {campaigns.data!.map((campaign) => (
                  <tr
                    key={campaign.id}
                    className={`hover:bg-info-50/50 cursor-pointer ${
                      selectedCampaignId === campaign.id
                        ? "bg-pirrot-blue-50"
                        : ""
                    }`}
                    onClick={() => setSelectedCampaignId(campaign.id)}
                  >
                    <td className="px-4 py-3 font-medium">
                      {campaign.promotionCode ?? campaign.promotionCodeId}
                    </td>
                    <td className="text-info-700 px-4 py-3">
                      {campaign.partnerUser?.email?.slice(0, 20) ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      {campaign.timesRedeemed} /{" "}
                      {campaign.maxRedemptions ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          campaign.promotionActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-zinc-200 text-zinc-700"
                        }`}
                      >
                        {campaign.promotionActive ? "Aktiv" : "Inaktiv"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="content-card p-4">
          {selected ? (
            <div className="space-y-3">
              <h4 className="text-sm font-black uppercase">Code Verwaltung</h4>
              <div className="bg-info-50 rounded p-3">
                <p className="text-info-700 text-xs">Code</p>
                <p className="font-semibold">{selected.promotionCode ?? "-"}</p>
                <p className="text-info-700 mt-2 text-xs">Partner</p>
                <p className="font-semibold">
                  {selected.partnerUser?.email ?? "-"}
                </p>
                <p className="text-info-700 mt-2 text-xs">Erstellt</p>
                <p className="font-semibold">
                  {formatDate(selected.createdAt)}
                </p>
              </div>

              <button
                type="button"
                className="btn-soft w-full px-3 py-2 text-xs"
                disabled={setActive.isPending}
                onClick={() =>
                  setActive.mutate({
                    campaignId: selected.id,
                    active: !selected.promotionActive,
                  })
                }
              >
                {selected.promotionActive ? "Deaktivieren" : "Aktivieren"}
              </button>

              <div className="border-info-200 border-t pt-3">
                <p className="text-info-700 text-xs font-semibold uppercase">
                  Code rotieren
                </p>
                <input
                  value={rotateCode}
                  onChange={(e) => setRotateCode(e.target.value.toUpperCase())}
                  className="field-shell mt-2 w-full px-3 py-2 text-sm"
                  placeholder="Neuer Code (optional)"
                />
                <input
                  value={rotateMaxRedemptions}
                  onChange={(e) => setRotateMaxRedemptions(e.target.value)}
                  className="field-shell mt-2 w-full px-3 py-2 text-sm"
                  placeholder="Max Redemptions"
                />
                <input
                  value={rotateValidForDays}
                  onChange={(e) => setRotateValidForDays(e.target.value)}
                  className="field-shell mt-2 w-full px-3 py-2 text-sm"
                  placeholder="Gültig für Tage"
                />
                <button
                  type="button"
                  className="btn-solid mt-2 w-full px-3 py-2 text-xs"
                  disabled={rotate.isPending}
                  onClick={() =>
                    rotate.mutate({
                      campaignId: selected.id,
                      promoCode:
                        rotateCode.trim().length > 0 ? rotateCode : undefined,
                      maxRedemptions: Number(rotateMaxRedemptions),
                      validForDays: Number(rotateValidForDays),
                    })
                  }
                >
                  {rotate.isPending ? "Rotiere..." : "Rotieren"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-info-700 text-sm">
              Bitte links einen Partner-Code auswählen.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function PartnerUsersPanel() {
  const [search, setSearch] = useState("");
  const [roleDraft, setRoleDraft] = useState<Record<string, string>>({});

  const users = api.partner.listAdminUsersOverview.useQuery(undefined, {
    staleTime: 30000,
  });

  const setRole = api.partner.setAdminUserRole.useMutation();

  const filteredUsers = useMemo(() => {
    if (!users.data?.users) return [];
    if (!search.trim()) return users.data.users;
    const q = search.toLowerCase();
    return users.data.users.filter(
      (u) =>
        (u.email?.toLowerCase().includes(q) ?? false) ||
        (u.name?.toLowerCase().includes(q) ?? false) ||
        u.id.toLowerCase().includes(q),
    );
  }, [users.data, search]);

  return (
    <section className="space-y-4">
      <div className="content-card flex items-center justify-between p-4">
        <div>
          <h3 className="text-lg font-black uppercase">
            Partner und User Übersicht
          </h3>
          {users.data ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {Object.entries(users.data.roleCounts).map(([role, count]) => (
                <span
                  key={role}
                  className="rounded bg-white/70 px-2 py-1 font-semibold"
                >
                  {role}: {count}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => users.refetch()}
          className="btn-soft px-3 py-1.5 text-xs"
        >
          Aktualisieren
        </button>
      </div>

      <div className="content-card p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="field-shell mb-4 w-full px-3 py-2 text-sm"
          placeholder="Suche nach E-Mail, Name oder ID..."
        />
        {users.isLoading ? (
          <LoadingSpinner />
        ) : filteredUsers.length === 0 ? (
          <p className="text-info-600 text-center">Keine Benutzer gefunden</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-info-50 text-info-700 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">E-Mail</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Rollen</th>
                  <th className="px-4 py-3 font-semibold">Statistik</th>
                  <th className="px-4 py-3 font-semibold">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-info-100 divide-y">
                {filteredUsers.map((entry) => {
                  const nextRole = roleDraft[entry.id] ?? entry.role;
                  return (
                    <tr key={entry.id} className="hover:bg-info-50/50">
                      <td className="px-4 py-3 font-medium">
                        {entry.email ?? "-"}
                      </td>
                      <td className="text-info-700 px-4 py-3">
                        {entry.name ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={nextRole}
                          onChange={(e) =>
                            setRoleDraft((prev) => ({
                              ...prev,
                              [entry.id]: e.target.value,
                            }))
                          }
                          className="field-shell px-2 py-1 text-xs"
                        >
                          {[
                            "ADMIN",
                            "STAFF",
                            "MODERATOR",
                            "USER",
                            "SPONSOR",
                            "PARTNER",
                          ].map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="text-info-700 px-4 py-3 text-xs">
                        <div>Kampagnen: {entry.campaignCount}</div>
                        <div>
                          Partner-Orders: {entry._count.partnerOrdersAsPartner}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="btn-soft px-3 py-1.5 text-xs"
                          disabled={
                            setRole.isPending || nextRole === entry.role
                          }
                          onClick={() =>
                            setRole.mutate({
                              userId: entry.id,
                              role: nextRole as
                                | "ADMIN"
                                | "STAFF"
                                | "MODERATOR"
                                | "USER"
                                | "SPONSOR"
                                | "PARTNER",
                            })
                          }
                        >
                          Speichern
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function SalesPanel() {
  const now = new Date();
  const [year, setYear] = useState(String(now.getUTCFullYear()));
  const [month, setMonth] = useState(String(now.getUTCMonth() + 1));

  const sales = api.partner.getAdminSalesOverview.useQuery(
    {
      cycleYear: Number(year),
      cycleMonth: Number(month),
    },
    { staleTime: 60000 },
  );

  return (
    <section className="space-y-4">
      <div className="content-card flex items-center justify-between p-4">
        <div>
          <h3 className="text-lg font-black uppercase">Verkaufsübersicht</h3>
          <div className="mt-2 flex gap-2">
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="field-shell w-28 px-3 py-2 text-sm"
              placeholder="Jahr"
            />
            <input
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="field-shell w-24 px-3 py-2 text-sm"
              placeholder="Monat"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => sales.refetch()}
          className="btn-soft px-3 py-1.5 text-xs"
        >
          Aktualisieren
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="content-card p-4">
          <h4 className="text-sm font-black uppercase">Zusammenfassung</h4>
          {sales.isLoading ? (
            <LoadingSpinner />
          ) : sales.data ? (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-info-700">Bestellungen</span>
                <span className="font-semibold">{sales.data.orderCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-info-700">Angepasste Bestellungen</span>
                <span className="font-semibold">
                  {sales.data.adjustedOrderCount}
                </span>
              </div>
              <div className="border-info-200 flex justify-between border-t pt-2">
                <span className="text-info-700">Umsatz gesamt</span>
                <span className="font-bold">
                  {formatEuro(sales.data.totals.grandTotalAmount)}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="content-card p-4">
          <h4 className="text-sm font-black uppercase">Nach Status</h4>
          {sales.data ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(sales.data.byStatus).map(([status, count]) => (
                <span
                  key={status}
                  className={`rounded px-3 py-1.5 text-xs font-semibold ${getStatusColor(status)}`}
                >
                  {getStatusLabel(status)}: {count}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="content-card p-4 lg:col-span-2">
          <h4 className="text-sm font-black uppercase">Top Partner</h4>
          {sales.data?.topPartners && sales.data.topPartners.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-info-50 text-info-700 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Partner</th>
                    <th className="px-4 py-2 font-semibold">Bestellungen</th>
                  </tr>
                </thead>
                <tbody className="divide-info-100 divide-y">
                  {sales.data.topPartners.map((entry) => (
                    <tr key={entry.partnerUserId}>
                      <td className="px-4 py-2">
                        {entry.partner?.email ?? entry.partnerUserId}
                      </td>
                      <td className="px-4 py-2 font-medium">
                        {entry.orderCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-info-600 mt-3">
              Keine Daten für diesen Zeitraum
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function PlannerModulesPanel() {
  const overview = api.partner.getAdminPlannerModuleOverview.useQuery(
    undefined,
    {
      staleTime: 60000,
    },
  );

  return (
    <section className="space-y-4">
      <div className="content-card flex items-center justify-between p-4">
        <h3 className="text-lg font-black uppercase">Planer und Module</h3>
        <button
          type="button"
          onClick={() => overview.refetch()}
          className="btn-soft px-3 py-1.5 text-xs"
        >
          Aktualisieren
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="content-card p-4">
          <h4 className="text-sm font-black uppercase">Übersicht</h4>
          {overview.isLoading ? (
            <LoadingSpinner />
          ) : overview.data ? (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-info-700">Templates</span>
                <span className="font-semibold">
                  {overview.data.totalTemplates}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-info-700">Featured Templates</span>
                <span className="font-semibold">
                  {overview.data.featuredTemplates}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-info-700">Planer gesamt</span>
                <span className="font-semibold">
                  {overview.data.totalPlanners}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-info-700">Module gesamt</span>
                <span className="font-semibold">
                  {overview.data.totalModules}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="content-card p-4">
          <h4 className="text-sm font-black uppercase">Visibility</h4>
          {overview.data ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(overview.data.visibility).map(([key, value]) => (
                <span
                  key={key}
                  className="rounded bg-white/70 px-3 py-1.5 text-xs font-semibold"
                >
                  {key}: {value}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="content-card p-4 lg:col-span-2">
          <h4 className="text-sm font-black uppercase">Module nach Typ</h4>
          {overview.data && overview.data.modulesByType.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-info-50 text-info-700 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Typ</th>
                    <th className="px-4 py-2 font-semibold">Anzahl</th>
                  </tr>
                </thead>
                <tbody className="divide-info-100 divide-y">
                  {overview.data.modulesByType.map((entry) => (
                    <tr key={entry.typeId}>
                      <td className="px-4 py-2">{entry.typeName}</td>
                      <td className="px-4 py-2 font-medium">{entry.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-info-600 mt-3">Keine Module vorhanden</p>
          )}
        </div>
      </div>
    </section>
  );
}

function FulfillmentPanel() {
  const [activeStatus, setActiveStatus] = useState<
    | "SUBMITTED_BY_SCHOOL"
    | "UNDER_PARTNER_REVIEW"
    | "PARTNER_CONFIRMED"
    | "PARTNER_DECLINED"
    | "RELEASED_TO_PRODUCTION"
    | "FULFILLED"
  >("SUBMITTED_BY_SCHOOL");
  const [adjustMode, setAdjustMode] = useState<"FIXED" | "PERCENT_DISCOUNT">(
    "PERCENT_DISCOUNT",
  );
  const [percentValue, setPercentValue] = useState("40");
  const [fixedValue, setFixedValue] = useState("600");
  const [reason, setReason] = useState("Partner Deal");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const orders = api.partner.listAdminPartnerOrders.useQuery(
    { statuses: [activeStatus] },
    { staleTime: 15000 },
  );

  const adjustOrder = api.partner.adjustPartnerOrderAmount.useMutation();
  const confirmOrder = api.partner.adminConfirmPartnerOrder.useMutation();
  const releaseOrder =
    api.partner.adminReleasePartnerOrderToProduction.useMutation();

  const selectedOrder = useMemo(
    () => orders.data?.find((order) => order.id === selectedOrderId) ?? null,
    [orders.data, selectedOrderId],
  );

  const isBusy =
    adjustOrder.isPending || confirmOrder.isPending || releaseOrder.isPending;

  return (
    <section className="space-y-4">
      <div className="content-card flex items-center justify-between p-4">
        <div>
          <h3 className="text-lg font-black uppercase">
            Fulfillment Bestellungen
          </h3>
          <p className="text-info-700 mt-1 text-xs">
            Admin und Staff können Beträge anpassen, bestätigen und an die
            Produktion freigeben.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "SUBMITTED_BY_SCHOOL",
              "UNDER_PARTNER_REVIEW",
              "PARTNER_CONFIRMED",
              "PARTNER_DECLINED",
              "RELEASED_TO_PRODUCTION",
              "FULFILLED",
            ].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setActiveStatus(
                    status as
                      | "SUBMITTED_BY_SCHOOL"
                      | "UNDER_PARTNER_REVIEW"
                      | "PARTNER_CONFIRMED"
                      | "PARTNER_DECLINED"
                      | "RELEASED_TO_PRODUCTION"
                      | "FULFILLED",
                  );
                  setSelectedOrderId(null);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  activeStatus === status
                    ? "bg-pirrot-blue-100 text-pirrot-blue-900"
                    : "text-info-800 bg-white/60"
                }`}
              >
                {getStatusLabel(status)}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => orders.refetch()}
          className="btn-soft px-3 py-1.5 text-xs"
        >
          Aktualisieren
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr,1fr]">
        <div className="content-card max-h-[600px] overflow-y-auto p-0">
          {orders.isLoading ? (
            <div className="p-8 text-center">
              <LoadingSpinner />
            </div>
          ) : orders.data?.length === 0 ? (
            <div className="text-info-600 p-8 text-center">
              Keine Bestellungen in diesem Status
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-info-50 text-info-700 sticky top-0 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Buch</th>
                  <th className="px-4 py-3 font-semibold">Partner</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Betrag</th>
                </tr>
              </thead>
              <tbody className="divide-info-100 divide-y">
                {orders.data!.map((order) => (
                  <tr
                    key={order.id}
                    className={`hover:bg-info-50/50 cursor-pointer ${
                      selectedOrderId === order.id ? "bg-pirrot-blue-50" : ""
                    }`}
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    <td className="px-4 py-3 font-medium">
                      {order.book?.name ?? "Partner-Bestellung"}
                    </td>
                    <td className="text-info-700 px-4 py-3">
                      {order.partnerUser?.email?.slice(0, 25) ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${getStatusColor(order.status)}`}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatEuro(order.totals.grandTotalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="content-card p-4">
          {selectedOrder ? (
            <div className="space-y-3">
              <h4 className="text-sm font-black uppercase">
                Bestellung steuern
              </h4>
              <div className="bg-info-50 rounded p-3">
                <p className="text-info-700 text-xs">Aktueller Betrag</p>
                <p className="text-xl font-bold">
                  {formatEuro(selectedOrder.totals.grandTotalAmount)}
                </p>
                {selectedOrder.adminSettlementAdjustment && (
                  <p className="mt-1 text-xs text-emerald-700">
                    Angepasst:{" "}
                    {formatEuro(
                      (
                        selectedOrder.adminSettlementAdjustment as {
                          finalGrandTotalAmount?: number;
                        }
                      ).finalGrandTotalAmount ?? 0,
                    )}
                  </p>
                )}
              </div>

              {selectedOrder.status === "SUBMITTED_BY_SCHOOL" ||
              selectedOrder.status === "UNDER_PARTNER_REVIEW" ? (
                <>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustMode("PERCENT_DISCOUNT")}
                      className={`rounded px-2 py-1 text-xs ${
                        adjustMode === "PERCENT_DISCOUNT"
                          ? "bg-pirrot-blue-100 text-pirrot-blue-900"
                          : "bg-white/60"
                      }`}
                    >
                      Prozent
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustMode("FIXED")}
                      className={`rounded px-2 py-1 text-xs ${
                        adjustMode === "FIXED"
                          ? "bg-pirrot-blue-100 text-pirrot-blue-900"
                          : "bg-white/60"
                      }`}
                    >
                      Fester Betrag
                    </button>
                  </div>

                  {adjustMode === "PERCENT_DISCOUNT" ? (
                    <input
                      value={percentValue}
                      onChange={(e) => setPercentValue(e.target.value)}
                      className="field-shell w-full px-3 py-2 text-sm"
                      placeholder="Rabatt in %"
                    />
                  ) : (
                    <input
                      value={fixedValue}
                      onChange={(e) => setFixedValue(e.target.value)}
                      className="field-shell w-full px-3 py-2 text-sm"
                      placeholder="Finaler Betrag in EUR"
                    />
                  )}

                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="field-shell w-full px-3 py-2 text-sm"
                    placeholder="Grund"
                  />

                  <button
                    type="button"
                    disabled={isBusy}
                    className="btn-solid w-full px-3 py-2 disabled:opacity-60"
                    onClick={() => {
                      if (adjustMode === "PERCENT_DISCOUNT") {
                        adjustOrder.mutate({
                          partnerOrderId: selectedOrder.id,
                          reason,
                          adjustment: {
                            type: "PERCENT_DISCOUNT",
                            percent: Number(percentValue),
                          },
                        });
                      } else {
                        adjustOrder.mutate({
                          partnerOrderId: selectedOrder.id,
                          reason,
                          adjustment: {
                            type: "FIXED",
                            amountCents: Math.round(Number(fixedValue) * 100),
                          },
                        });
                      }
                    }}
                  >
                    {adjustOrder.isPending ? "Anpasse..." : "Betrag anwenden"}
                  </button>
                </>
              ) : null}

              {selectedOrder.status !== "PARTNER_CONFIRMED" &&
              selectedOrder.status !== "RELEASED_TO_PRODUCTION" &&
              selectedOrder.status !== "FULFILLED" ? (
                <button
                  type="button"
                  disabled={isBusy}
                  className="btn-soft w-full px-3 py-2 disabled:opacity-60"
                  onClick={() =>
                    confirmOrder.mutate({ partnerOrderId: selectedOrder.id })
                  }
                >
                  {confirmOrder.isPending
                    ? "Bestätige..."
                    : "Als Plattform bestätigen"}
                </button>
              ) : null}

              {selectedOrder.status === "PARTNER_CONFIRMED" ? (
                <button
                  type="button"
                  disabled={isBusy}
                  className="btn-soft w-full px-3 py-2 disabled:opacity-60"
                  onClick={() =>
                    releaseOrder.mutate({ partnerOrderId: selectedOrder.id })
                  }
                >
                  {releaseOrder.isPending
                    ? "Freigabe..."
                    : "Für Produktion freigeben"}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-info-700 text-sm">
              Bitte links eine Bestellung auswählen.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default function AdminWorkspace() {
  const [view, setView] = useState<AdminView>("fulfillment");

  return (
    <>
      <FeedbackToast />
      <div className="space-y-4">
        <div className="content-card flex flex-wrap gap-2 p-3">
          {[
            { id: "fulfillment", label: "Bestellungen" },
            { id: "stripe", label: "Stripe Coupons" },
            { id: "partnerCodes", label: "Partner Codes" },
            { id: "partnerUsers", label: "Partner & User" },
            { id: "sales", label: "Verkäufe" },
            { id: "plannerModules", label: "Planer & Module" },
          ].map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`rounded-lg px-3 py-2 text-xs font-bold uppercase ${
                view === entry.id
                  ? "bg-pirrot-blue-100 text-pirrot-blue-900"
                  : "text-info-800 bg-white/60"
              }`}
              onClick={() => setView(entry.id as AdminView)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {view === "fulfillment" && <FulfillmentPanel />}
        {view === "stripe" && <StripeCouponsPanel />}
        {view === "partnerCodes" && <PartnerCodesPanel />}
        {view === "partnerUsers" && <PartnerUsersPanel />}
        {view === "sales" && <SalesPanel />}
        {view === "plannerModules" && <PlannerModulesPanel />}
      </div>
    </>
  );
}
