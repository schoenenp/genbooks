"use client";
import LoadingSpinner from "@/app/_components/loading-spinner";
import { api } from "@/trpc/react";
import { BookOpenText, LoaderCircle, TrashIcon } from "lucide-react";
import Link from "next/link";
import { ToggleSwitch } from "@/app/_components/toggle-switch";
import { DashboardEmptyState } from "./dashboard-states";
import { useState } from "react";

export default function PlanerSection() {
  const utils = api.useUtils();
  const [userBooks] = api.book.getUserBooks.useSuspenseQuery();
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

  function handleDeleteBook(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const deletedBookId = event.currentTarget.id;
    deleteBook.mutate({ bookId: deletedBookId });
  }

  const handleToggle = (id: string, checked: boolean) => {
    toggleTemplate.mutate({ bookId: id, isTemplate: checked });
  };

  const isStaff =
    userData?.role === "ADMIN" ||
    userData?.role === "STAFF" ||
    userData?.role === "MODERATOR" ||
    userData?.role === "SPONSOR";

  return (
    <div className="content-card rise-in relative flex flex-1 flex-col gap-4 p-4 lg:min-h-96">
      <h2 className="text-2xl font-bold uppercase">Planer</h2>
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
                <Link className="font-bold text-info-900 hover:text-pirrot-blue-700" href={`/config?bookId=${book.id}`}>{book.name}</Link>

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
                      <LoaderCircle className="size-4 animate-spin text-info-700" />
                    )}
                  </div>
                )}

                <div className="mt-auto flex gap-2">
                  <Link
                    className="flex justify-center items-center btn-soft rounded-md px-3 text-xs uppercase"
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
