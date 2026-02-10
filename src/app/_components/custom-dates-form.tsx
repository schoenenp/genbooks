"use client";
import { api } from "@/trpc/react";
import { X, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import { de } from "date-fns/locale";
import { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { formatDisplayDate, parseDate } from "@/util/date";

registerLocale("de", de);

export default function CustomDatesForm(props: { bookId: string }) {
  const { bookId } = props;

  const utils = api.useUtils();
  const { data: book, isLoading } = api.book.getById.useQuery({ id: bookId });

  const saveDates = api.book.saveCustomDates.useMutation({
    onSuccess: async () => {
      console.log("Custom dates saved successfully");
      await utils.book.getById.invalidate({ id: bookId });
    },
    onError: (error) => {
      console.error("Failed to save custom dates:", error);
    },
  });

  const [dates, setDates] = useState<{ date: Date; name: string }[]>(
    (() => {
      const initial =
        book?.customDates?.map((d) => ({
          date: new Date(d.date),
          name: d.name,
        })) ?? [];
      console.log("Initial custom dates:", initial);
      return initial;
    })(),
  );

  const [newDate, setNewDate] = useState<Date | null>(null);
  const [newDateInput, setNewDateInput] = useState("");
  const [newName, setNewName] = useState("");
  const [dateError, setDateError] = useState("");

  // Parse date input and update newDate
  useEffect(() => {
    if (typeof newDateInput !== "string") {
      setNewDate(null);
      setDateError("");
      return;
    }
    if (newDateInput.trim() === "") {
      setNewDate(null);
      setDateError("");
      return;
    }
    const parsed = parseDate(newDateInput);
    if (parsed) {
      setNewDate(parsed);
      setDateError("");
    } else {
      setNewDate(null);
      setDateError(
        "Ungültiges Datum. Bitte verwenden Sie das Format DD.MM.YYYY.",
      );
    }
  }, [newDateInput]);

  function addDate() {
    if (!newDate || !newName) {
      if (!newDate && newDateInput.trim() !== "") {
        setDateError("Bitte geben Sie ein gültiges Datum ein.");
      }
      return;
    }
    const updated = [...dates, { date: newDate, name: newName }];
    setDates(updated);
    saveDates.mutate({
      bookId,
      dates: updated.map((d) => ({
        date: d.date.toISOString().split("T")[0]!,
        name: d.name,
      })),
    });
    setNewDate(null);
    setNewDateInput("");
    setNewName("");
    setDateError("");
  }

  function removeDate(index: number) {
    const updated = dates.filter((_, i) => i !== index);
    setDates(updated);
    saveDates.mutate({
      bookId,
      dates: updated.map((d) => ({
        date: d.date.toISOString().split("T")[0]!,
        name: d.name,
      })),
    });
  }

  if (isLoading) return <div>Loading custom dates...</div>;
  if (!book) return null;

  return (
    <div className="border-pirrot-blue-200 bg-pirrot-blue-50/50 flex flex-col gap-4 rounded border p-4">
      <h3 className="text-lg font-bold">Eigene Termine</h3>

      <div className="flex flex-col gap-2">
        {dates.map((d, i) => (
          <div
            key={`${d.date.toISOString()}-${d.name}`}
            className="border-pirrot-blue-100 flex items-center justify-between rounded border bg-white p-2"
          >
            <div>
              <span className="mr-2 font-bold">
                {formatDisplayDate(d.date)}:
              </span>
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
        <DatePicker
          selected={newDate}
          onChange={(date: Date | null) => {
            setNewDate(date);
            setNewDateInput(date ? formatDisplayDate(date) : "");
            setDateError("");
          }}
          onChangeRaw={(e) => {
            if (e) setNewDateInput((e.target as HTMLInputElement).value);
          }}
          value={newDateInput}
          dateFormat="dd.MM.yyyy"
          locale="de"
          className={`rounded border p-1 text-sm ${
            dateError ? "border-red-500" : "border-gray-300"
          }`}
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
      {dateError && <p className="mt-1 text-sm text-red-500">{dateError}</p>}
    </div>
  );
}
