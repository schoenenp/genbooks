"use client";
import LoadingSpinner from "@/app/_components/loading-spinner";
import { api } from "@/trpc/react";
import { BookOpenText, LoaderCircle, TrashIcon } from "lucide-react";
import Link from "next/link";
import { ToggleSwitch } from "@/app/_components/toggle-switch";
import { DashboardEmptyState } from "./dashboard-states";
import { useMemo, useState } from "react";

function getPartnerClaimStatusLabel(
  status: "PENDING" | "VERIFIED" | "CONSUMED" | "EXPIRED",
): string {
  switch (status) {
    case "PENDING":
      return "E-Mail Verifizierung offen";
    case "VERIFIED":
      return "Verifiziert";
    case "CONSUMED":
      return "Fortsetzbar";
    case "EXPIRED":
      return "Abgelaufen";
    default:
      return status;
  }
}

function getPartnerClaimStatusClass(
  status: "PENDING" | "VERIFIED" | "CONSUMED" | "EXPIRED",
): string {
  switch (status) {
    case "PENDING":
      return "bg-amber-100 text-amber-800";
    case "VERIFIED":
      return "bg-sky-100 text-sky-800";
    case "CONSUMED":
      return "bg-emerald-100 text-emerald-800";
    case "EXPIRED":
      return "bg-zinc-200 text-zinc-700";
    default:
      return "bg-zinc-200 text-zinc-700";
  }
}

function formatDate(value?: Date): string {
  if (!value) {
    return "-";
  }
  return value.toLocaleString("de-DE");
}

export default function PlanerSection() {
  const utils = api.useUtils();
  const [userBooks] = api.book.getUserBooks.useSuspenseQuery();
  const partnerClaims = api.partner.listPartnerClaims.useQuery();
  const { data: userData } = api.user.getMyRole.useQuery();
  const [pendingDeleteBookId, setPendingDeleteBookId] = useState<string | null>(
    null,
  );
  const [pendingToggleBookId, setPendingToggleBookId] = useState<string | null>(
    null,
  );

  const deleteBook = api.book.delete.useMutation({
    onMutate: ({ bookId }) => {
      setPendingDeleteBookId(bookId);
    },
    onSuccess: async () => {
      await utils.book.getUserBooks.invalidate();
    },
    onSettled: () => {
      setPendingDeleteBookId(null);
    },
  });
  const toggleTemplate = api.book.toggleTemplate.useMutation({
    onMutate: ({ bookId }) => {
      setPendingToggleBookId(bookId);
    },
    onSuccess: async () => {
      await utils.book.getUserBooks.invalidate();
    },
    onSettled: () => {
      setPendingToggleBookId(null);
    },
  });
  const togglePublic = api.book.togglePublic.useMutation({
    onMutate: ({ bookId }) => {
      setPendingToggleBookId(bookId);
    },
    onSuccess: async () => {
      await utils.book.getUserBooks.invalidate();
    },
    onSettled: () => {
      setPendingToggleBookId(null);
    },
  });

  function handleDeleteBook(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const deletedBookId = event.currentTarget.id;
    deleteBook.mutate({ bookId: deletedBookId });
  }

  const handleToggle = (id: string, checked: boolean) => {
    toggleTemplate.mutate({ bookId: id, isTemplate: checked });
  };

  const handleTogglePublic = (id: string, checked: boolean) => {
    togglePublic.mutate({ bookId: id, isPublic: checked });
  };

  const isStaff =
    userData?.role === "ADMIN" ||
    userData?.role === "STAFF" ||
    userData?.role === "MODERATOR" ||
    userData?.role === "SPONSOR" ||
    userData?.role === "PARTNER";
  const partnerClaimsData = useMemo(
    () => partnerClaims.data ?? [],
    [partnerClaims.data],
  );
  const resumablePartnerClaims = useMemo(
    () =>
      partnerClaimsData
        .filter(
          (claim) =>
            claim.book &&
            (claim.status === "CONSUMED" || claim.status === "VERIFIED"),
        )
        .sort((a, b) => {
          const aUpdated = a.book?.updatedAt
            ? new Date(a.book.updatedAt).getTime()
            : 0;
          const bUpdated = b.book?.updatedAt
            ? new Date(b.book.updatedAt).getTime()
            : 0;
          return bUpdated - aUpdated;
        }),
    [partnerClaimsData],
  );
  const pendingPartnerClaims = useMemo(
    () =>
      partnerClaimsData
        .filter((claim) => !claim.book || claim.status === "PENDING")
        .sort((a, b) => a.expiresAt - b.expiresAt),
    [partnerClaimsData],
  );

  return (
    <div className="content-card rise-in relative flex flex-1 flex-col gap-4 p-4 lg:min-h-96">
      <h2 className="text-2xl font-bold uppercase">Planer</h2>
      <div className="content-card flex flex-col gap-3 p-3">
        <h3 className="text-lg font-bold">Partner-Vorlagen fortsetzen</h3>
        {partnerClaims.isLoading ? (
          <LoadingSpinner />
        ) : resumablePartnerClaims.length > 0 ? (
          <ul className="flex flex-col gap-2 text-sm">
            {resumablePartnerClaims.map((claim) => (
              <li
                key={claim.id}
                className="field-shell flex flex-wrap items-center justify-between gap-2 p-2"
              >
                <div>
                  <p className="font-semibold">
                    {claim.book?.name ?? "Partner-Vorlage"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`rounded px-2 py-0.5 font-semibold ${getPartnerClaimStatusClass(claim.status)}`}
                    >
                      {getPartnerClaimStatusLabel(claim.status)}
                    </span>
                    <span className="text-info-700">
                      Zuletzt bearbeitet: {formatDate(claim.book?.updatedAt)}
                    </span>
                  </div>
                </div>
                {claim.book ? (
                  <Link
                    href={`/config?bookId=${encodeURIComponent(claim.book.id)}`}
                    className="btn-solid px-3 py-2"
                  >
                    Konfiguration fortsetzen
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-info-700 text-sm">
            Noch keine übernommenen Partner-Vorlagen vorhanden.
          </p>
        )}
        {pendingPartnerClaims.length > 0 ? (
          <div className="rounded border border-amber-300/70 bg-amber-50/70 p-3 text-sm">
            <p className="font-semibold">Aktion erforderlich</p>
            <ul className="mt-2 flex flex-col gap-1 text-xs">
              {pendingPartnerClaims.map((claim) => (
                <li
                  key={claim.id}
                  className="flex flex-wrap items-center gap-2"
                >
                  <span
                    className={`rounded px-2 py-0.5 font-semibold ${getPartnerClaimStatusClass(claim.status)}`}
                  >
                    {getPartnerClaimStatusLabel(claim.status)}
                  </span>
                  <span>
                    Code: <b>{claim.promotionCodeId}</b>
                  </span>
                  <span>
                    Gueltig bis:{" "}
                    <b>
                      {new Date(claim.expiresAt * 1000).toLocaleDateString(
                        "de-DE",
                      )}
                    </b>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-900">
              Bitte zuerst den Verifizierungslink aus der E-Mail bestaetigen.
            </p>
          </div>
        ) : null}
        {partnerClaims.error ? (
          <p className="text-pirrot-red-500 text-sm">
            {partnerClaims.error.message}
          </p>
        ) : null}
      </div>
      {userBooks.length === 0 ? (
        <DashboardEmptyState
          icon={BookOpenText}
          title="Noch keine Planer"
          description="Erstellen Sie Ihren ersten Planer und bearbeiten Sie ihn später hier im Dashboard."
          actionHref="/"
          actionLabel="Planer erstellen"
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {userBooks.map((book, index) => {
            const isDeletingThisBook =
              deleteBook.isPending && pendingDeleteBookId === book.id;
            const isTogglingThisBook =
              toggleTemplate.isPending && pendingToggleBookId === book.id;
            return (
              <div
                className="field-shell stagger-item flex aspect-video flex-col p-3"
                key={book.id}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <Link
                  className="text-info-900 hover:text-pirrot-blue-700 font-bold"
                  href={`/config?bookId=${book.id}`}
                >
                  {book.name}
                </Link>

                {/* Template Toggle */}
                {isStaff && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-pirrot-blue-950 text-xs font-bold uppercase">
                      Template
                    </span>
                    <ToggleSwitch
                      /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
                      checked={(book as any).isTemplate}
                      /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
                      onChange={(checked) => handleToggle(book.id, checked)}
                      disabled={isTogglingThisBook}
                    />
                    {isTogglingThisBook && (
                      <LoaderCircle className="text-info-700 size-4 animate-spin" />
                    )}
                  </div>
                )}

                {/* Public Toggle - only show for templates */}
                {isStaff && (book as any).isTemplate && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-pirrot-blue-950 text-xs font-bold uppercase">
                      Öffentlich
                    </span>
                    <ToggleSwitch
                      /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
                      checked={(book as any).isPublic}
                      /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
                      onChange={(checked) =>
                        handleTogglePublic(book.id, checked)
                      }
                      disabled={isTogglingThisBook}
                    />
                    {isTogglingThisBook && (
                      <LoaderCircle className="text-info-700 size-4 animate-spin" />
                    )}
                  </div>
                )}

                <div className="mt-auto flex gap-2">
                  <Link
                    className="btn-soft flex items-center justify-center rounded-md px-3 text-xs uppercase"
                    href={`/config?bookId=${book.id}`}
                  >
                    Bearbeiten
                  </Link>
                  <button
                    type="button"
                    disabled={isDeletingThisBook}
                    id={book.id}
                    onClick={handleDeleteBook}
                    className="btn-soft cursor-pointer rounded-md px-3 py-1 text-xs uppercase"
                  >
                    {isDeletingThisBook ? <LoadingSpinner /> : <TrashIcon />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
