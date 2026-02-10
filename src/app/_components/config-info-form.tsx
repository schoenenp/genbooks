"use client";
import { useState } from "react";
import { getRegionsByCountry, COUNTRIES } from "@/util/book/regions";
import { SaveIcon, XIcon } from "lucide-react";
import { api } from "@/trpc/react";
import DatePicker from "react-datepicker";
import { de } from "date-fns/locale";
import { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { formatDisplayDate } from "@/util/date";

registerLocale("de", de);

type ConfigInfoFormState = {
  id?: string;
  name: string | null;
  sub?: string | null;
  country: string | null;
  region: string | null;
  period: {
    start: Date;
    end?: Date;
  };
};

type InitialFormState = Omit<ConfigInfoFormState, "period"> & {
  period: {
    start: string;
    end?: string;
  };
};

export default function ConfigInfoForm({
  initialFormState,
  onAbortForm,
}: {
  initialFormState?: InitialFormState;
  onAbortForm: () => void;
}) {
  const [infoFormState, setInfoFormState] = useState<ConfigInfoFormState>(
    initialFormState
      ? {
          ...initialFormState,
          period: {
            start: new Date(initialFormState.period.start),
            end: initialFormState.period.end
              ? new Date(initialFormState.period.end)
              : undefined,
          },
        }
      : ({} as ConfigInfoFormState),
  );

  const [formError, setFormError] = useState<string | undefined>();
  const { id, name, sub, country, region, period } = infoFormState;

  const utils = api.useUtils();
  const updateBookInfo = api.book.updateInfo.useMutation({
    onSuccess: async () => {
      await utils.book.invalidate();
      await utils.config.init.invalidate({
        bookId: id,
      });
      onAbortForm();
    },
    onError: (err) => {
      switch (err.message) {
        case "UNAUTHORIZED":
          setFormError(
            `${err.message} —  Bitte loggen Sie sich ein um den Planer zu verwalten.`,
          );
          break;

        default:
          console.log();
          setFormError(
            `${err.message} — Formular Error, versuchen Sie es später erneut.`,
          );
          break;
      }
    },
  });

  function handleSaveConfigInfo(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    updateBookInfo.mutate({
      ...infoFormState,
      period: {
        start: infoFormState.period.start.toISOString().slice(0, 10),
        end: infoFormState.period.end?.toISOString().slice(0, 10),
      },
    });
  }

  function handleSaveCancel() {
    onAbortForm();
  }

  if (formError)
    return (
      <div className="font-baloo flex flex-col items-center justify-center gap-8 p-4 pt-5 pb-6 text-xl">
        <div className="flex w-full justify-between">
          <h1 className="text-pirrot-red-400 text-2xl font-bold">::Error::</h1>
        </div>
        <p>{formError}</p>
        <button
          className="bg-pirrot-red-300 border-pirrot-red-500/10 hover:bg-pirrot-red-400 cursor-pointer rounded border p-1 px-3 uppercase transition duration-300"
          type="button"
          onClick={() => setFormError(undefined)}
        >
          Ok
        </button>
      </div>
    );

  return (
    <form className="font-baloo flex flex-col items-center justify-center gap-8 p-4 pt-5 pb-6 text-xl">
      <div className="text-info-950 flex w-full flex-col gap-2">
        <label className="font-cairo font-bold" htmlFor="title">
          Titel
        </label>
        <input
          id="title"
          className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2"
          onChange={(e) =>
            setInfoFormState((prev) => ({
              ...prev,
              name: e.target.value,
            }))
          }
          value={name ?? ""}
        />
      </div>
      <div className="flex w-full flex-col gap-8 md:flex-row">
        <div className="text-info-950 flex w-full flex-1 flex-col gap-2">
          <label className="font-cairo font-bold" htmlFor="name">
            Schulart / Untertitel
          </label>
          <input
            id="sub"
            className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2"
            list="schoolsList"
            onChange={(e) =>
              setInfoFormState((prev) => ({
                ...prev,
                sub: e.target.value,
              }))
            }
            value={sub ?? ""}
          />
          <datalist id="schoolsList">
            {[
              "Grundschule",
              "Erweiterte Realschule",
              "Gesamtschule",
              "Gymnasium",
            ].map((item, index) => (
              <option key={index} value={item} />
            ))}
          </datalist>
        </div>

        <div className="w-full flex-1">
          <label className="font-cairo font-bold" htmlFor="country">
            Land
          </label>
          <select
            id="country"
            value={country ?? "DE"}
            onChange={(e) =>
              setInfoFormState((prev) => ({
                ...prev,
                country: e.target.value,
                region: "",
              }))
            }
            className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full flex-1">
          <label className="font-cairo font-bold" htmlFor="region">
            Bundesland
          </label>
          <select
            value={region ?? ""}
            onChange={(e) =>
              setInfoFormState((prev) => ({
                ...prev,
                region: e.target.value,
              }))
            }
            className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2"
          >
            <option value="">-- Bitte wählen --</option>
            {getRegionsByCountry(country ?? "DE").map((r) => (
              <option key={r.code} value={r.code}>
                {r.land}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="text-info-950 flex w-full flex-col justify-between gap-8 lg:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <label className="font-cairo font-bold" htmlFor="start">
            Planer Start
          </label>
          <DatePicker
            selected={period.start}
            onChange={(date: Date | null) => {
              if (date) {
                setInfoFormState((prev) => ({
                  ...prev,
                  period: {
                    start: date,
                    end: prev.period.end,
                  },
                }));
              }
            }}
            dateFormat="dd.MM.yyyy"
            locale="de"
            placeholderText="DD.MM.YYYY"
            className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2"
          />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <label className="font-cairo font-bold" htmlFor="end">
            Planer Ende
          </label>
          <DatePicker
            selected={period.end}
            onChange={(date: Date | null) => {
              setInfoFormState((prev) => ({
                ...prev,
                period: {
                  start: prev.period.start,
                  end: date || undefined,
                },
              }));
            }}
            dateFormat="dd.MM.yyyy"
            locale="de"
            placeholderText="DD.MM.YYYY"
            className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2"
          />
        </div>
      </div>
      <div className="flex w-full gap-8">
        <button
          type="button"
          onClick={handleSaveCancel}
          className={`hover:bg-pirrot-blue-100/50 bg-pirrot-blue-50 text-info-950 relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded border border-white/50 px-4 py-2 transition-colors duration-500 hover:animate-pulse`}
        >
          {" "}
          Abbrechen <XIcon />
        </button>
        <button
          type="button"
          onClick={handleSaveConfigInfo}
          className={`hover:bg-pirrot-blue-100/50 bg-pirrot-blue-50 text-info-950 relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded border border-white/50 px-4 py-2 transition-colors duration-500 hover:animate-pulse`}
        >
          Speichern <SaveIcon />
        </button>
      </div>
    </form>
  );
}
