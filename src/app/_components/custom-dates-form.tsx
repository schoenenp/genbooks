"use client";
import { api } from "@/trpc/react";
import { X, Plus } from "lucide-react";
import { useState } from "react";

export default function CustomDatesForm(props: { bookId: string }) {
  const { bookId } = props;
  const utils = api.useUtils();
  const { data: book } = api.book.getById.useQuery({ id: bookId });

  const saveDates = api.book.saveCustomDates.useMutation({
    onSuccess: async () => {
      await utils.book.getById.invalidate({ id: bookId });
    },
  });

  const [dates, setDates] = useState<{ date: string; name: string }[]>(
    book?.customDates?.map((d) => ({
      date: new Date(d.date).toISOString().split("T")[0] ?? "",
      name: d.name,
    })) ?? [],
  );

  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");

  function addDate() {
    if (!newDate || !newName) return;
    const updated = [...dates, { date: newDate, name: newName }];
    setDates(updated);
    saveDates.mutate({ bookId, dates: updated });
    setNewDate("");
    setNewName("");
  }

  function removeDate(index: number) {
    const updated = dates.filter((_, i) => i !== index);
    setDates(updated);
    saveDates.mutate({ bookId, dates: updated });
  }

  if (!book) return null;

  return (
    <div className="border-pirrot-blue-200 bg-pirrot-blue-50/50 flex flex-col gap-4 rounded border p-4">
      <h3 className="text-lg font-bold">Eigene Termine</h3>

      <div className="flex flex-col gap-2">
        {dates.map((d, i) => (
          <div
            key={`${d.date}-${d.name}`}
            className="border-pirrot-blue-100 flex items-center justify-between rounded border bg-white p-2"
          >
            <div>
              <span className="mr-2 font-bold">{d.date}:</span>
              <span>{d.name}</span>
            </div>
            <button
              type="button"
              onClick={() => removeDate(i)}
              className="text-pirrot-red-400 hover:text-pirrot-red-600"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="rounded border p-1 text-sm"
        />
        <input
          type="text"
          placeholder="Name (z.B. Wandertag)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 rounded border p-1 text-sm"
        />
        <button
          type="button"
          onClick={addDate}
          className="bg-pirrot-blue-500 hover:bg-pirrot-blue-600 rounded p-2 text-white disabled:opacity-50"
          disabled={!newDate || !newName || saveDates.isPending}
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
}
