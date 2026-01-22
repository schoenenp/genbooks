"use client";
import LoadingSpinner from "@/app/_components/loading-spinner";
import { api } from "@/trpc/react";
import { TrashIcon } from "lucide-react";
import Link from "next/link";
import { ToggleSwitch } from "@/app/_components/toggle-switch";

export default function PlanerSection() {
  const utils = api.useUtils();
  const [userBooks] = api.book.getUserBooks.useSuspenseQuery();
  const { data: userData } = api.user.getMyRole.useQuery();

  const deleteBook = api.book.delete.useMutation({
    onSuccess: async () => {
      await utils.book.getUserBooks.invalidate();
    },
  });
  const toggleTemplate = api.book.toggleTemplate.useMutation({
    onSuccess: async () => {
      await utils.book.getUserBooks.invalidate();
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
    userData?.role === "MODERATOR";

  return (
    <div className="border-pirrot-blue-500/5 relative flex flex-1 flex-col gap-4 rounded border p-4 lg:min-h-96">
      <h2 className="text-2xl font-bold uppercase">Planer</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {userBooks.map((book) => (
          <div
            className="bg-pirrot-blue-100/50 border-pirrot-blue-50 flex aspect-video flex-col rounded border p-2"
            key={book.id}
          >
            <Link href={`/config?bookId=${book.id}`}>{book.name}</Link>

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
                />
              </div>
            )}

            <div className="mt-auto flex gap-2">
              <Link
                className="bg-pirrot-red-300 border-pirrot-red-500/10 hover:bg-pirrot-red-400 rounded border p-1 px-3 uppercase transition duration-300"
                href={`/config?bookId=${book.id}`}
              >
                Bearbeiten
              </Link>
              <button
                type="button"
                disabled={deleteBook.isPending}
                id={book.id}
                onClick={handleDeleteBook}
                className="bg-pirrot-red-300 border-pirrot-red-500/10 hover:bg-pirrot-red-400 cursor-pointer rounded border p-1 px-3 uppercase transition duration-300"
              >
                {deleteBook.isPending ? <LoadingSpinner /> : <TrashIcon />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
