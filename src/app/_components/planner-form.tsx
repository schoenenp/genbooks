"use client";
import { ArrowRight, FolderUp, HelpCircle } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { getRegionsByCountry, COUNTRIES } from "@/util/book/regions";
import DatePicker from "react-datepicker";
import { de } from "date-fns/locale";
import { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

registerLocale("de", de);

const currentDate = new Date();
const nextYearDate = new Date(currentDate);
nextYearDate.setFullYear(currentDate.getFullYear() + 1);

interface PlannerFormProps {
  onFormChange?: (data: {
    name: string;
    sub: string;
    period: { start: string; end: string };
  }) => void;
  onValidationChange?: (isValid: boolean) => void;
}

export default function PlannerForm({
  onFormChange,
  onValidationChange,
}: PlannerFormProps) {
  const router = useRouter();
  const [name, setName] = useState<string>("Hausaufgaben");
  const [sub, setSub] = useState<string>("Meine Schule");
  const [country, setCountry] = useState<string>("DE");
  const [region, setRegion] = useState<string>("DE-SL");

  const makeConfig = api.book.init.useMutation({
    onSuccess: async (data) => {
      router.push(`/config?bookId=${data.id}`);
    },
  });

  const [period, setPeriod] = useState({
    start: currentDate,
    end: nextYearDate,
  });

  // Notify parent component of form changes for preview
  useEffect(() => {
    onFormChange?.({
      name,
      sub,
      period: {
        start: period.start.toISOString().slice(0, 16),
        end: period.end.toISOString().slice(0, 16),
      },
    });
  }, [name, sub, period, onFormChange]);

  // Add validation logic
  useEffect(() => {
    const isFutureEnd = period.start < period.end;
    let isValid =
      name.trim() !== "" &&
      sub.trim() !== "" &&
      period.start &&
      period.end &&
      isFutureEnd;

    if (typeof isValid === "string") {
      isValid = false;
    }

    onValidationChange?.(isValid);
  }, [name, sub, period, onValidationChange]);

  async function handleNewConfig(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    await makeConfig.mutateAsync({
      name,
      sub,
      country,
      region,
      planStart: period.start.toISOString(),
      planEnd: period.end.toISOString(),
    });
  }

  return (
    <form className="font-baloo z-[1] flex flex-col items-center justify-center gap-8 p-4 pt-5 pb-6 text-xl">
      <h2 className="text-pirrot-red-400 w-full text-start text-5xl font-bold">
        Infos zum Planer
      </h2>
      <p className="w-full pl-4 text-start text-xl">
        Füllen Sie mindestens die erforderlichen Felder aus. Die angegeben Daten
        können immer noch im Nachgang geändert werden. Durch einen einfachen
        Klick auf den Weiter Button leiten wir Sie Schritt-für-Schritt und
        problemlos durch den gesamten Prozess.
      </p>

      <div className="mb-8 w-full max-w-screen-xl">
        <h3 className="font-cairo text-info-950 mb-4 text-2xl font-bold">
          Schnellstart Vorlagen
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              name: "Grundschule",
              sub: "1. Klasse",
              period: {
                start: new Date("2024-08-01"),
                end: new Date("2025-07-31"),
              },
            },
            {
              name: "Gymnasium",
              sub: "5. Klasse",
              period: {
                start: new Date("2024-08-01"),
                end: new Date("2025-07-31"),
              },
            },
            {
              name: "Hausaufgaben",
              sub: "Meine Schule",
              period: {
                start: new Date("2024-08-01"),
                end: new Date("2025-07-31"),
              },
            },
          ].map((template, index) => (
            <button
              type="button"
              key={index}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setName(template.name);
                setSub(template.sub);
                setPeriod(template.period);
              }}
              className="border-pirrot-blue-200 hover:bg-pirrot-blue-100/50 rounded-lg border p-4 transition-colors"
            >
              <h4 className="font-cairo font-bold">{template.name}</h4>
              <p className="text-info-600 text-sm">{template.sub}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="text-info-950 flex w-full flex-col gap-2">
        <div className="flex items-center gap-2">
          <label className="font-cairo font-bold" htmlFor="title">
            Titel
          </label>
          <button
            type="button"
            className="text-info-400 hover:text-info-600"
            title="Der Titel erscheint auf dem Cover Ihres Planers"
          >
            <HelpCircle size={16} />
          </button>
        </div>
        <input
          id="title"
          className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2"
          onChange={(e) => setName(e.target.value)}
          value={name}
          placeholder="z.B. Hausaufgaben, Schulplaner, etc."
        />
      </div>

      <div className="flex w-full flex-col gap-8 md:flex-row">
        <div className="text-info-950 flex w-full flex-1 flex-col gap-2">
          <label className="font-cairo font-bold" htmlFor="sub">
            Schulart / Untertitel
          </label>
          <input
            id="sub"
            className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2"
            list="schoolsList"
            onChange={(e) => setSub(e.target.value)}
            value={sub}
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
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setRegion("");
            }}
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
            id="region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2"
          >
            <option value="">-- Bitte wählen --</option>
            {getRegionsByCountry(country).map((r) => (
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
              if (date) setPeriod({ ...period, start: date });
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
              if (date) setPeriod({ ...period, end: date });
            }}
            dateFormat="dd.MM.yyyy"
            locale="de"
            placeholderText="DD.MM.YYYY"
            className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2"
          />
        </div>
      </div>

      <div className="flex w-full gap-4">
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(
              "planner-draft",
              JSON.stringify({
                name,
                sub,
                country,
                region,
                period: {
                  start: period.start.toISOString(),
                  end: period.end.toISOString(),
                },
              }),
            );
          }}
          className="text-info-600 hover:text-info-800 text-sm underline"
        >
          Entwurf speichern
        </button>
        <button
          type="button"
          onClick={() => {
            const draft = localStorage.getItem("planner-draft");
            if (draft) {
              const data = JSON.parse(draft) as {
                name: string;
                sub: string;
                country: string;
                region: string;
                period: {
                  start: string;
                  end: string;
                };
              };
              setName(data.name);
              setSub(data.sub);
              setCountry(data.country);
              setRegion(data.region);
              setPeriod({
                start: new Date(data.period.start),
                end: new Date(data.period.end),
              });
            }
          }}
          className="text-info-600 hover:text-info-800 text-sm underline"
        >
          Entwurf laden
        </button>
      </div>

      <div className="flex w-full gap-8">
        <Link
          href="dashboard?view=planer"
          className="hover:bg-pirrot-blue-100/50 bg-pirrot-blue-50 text-info-950 relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded border border-white/50 px-4 py-2 transition-colors duration-500 hover:animate-pulse"
        >
          Planer Laden <FolderUp />
        </Link>
        <button
          onClick={handleNewConfig}
          disabled={makeConfig.isPending}
          className="hover:bg-pirrot-blue-100/50 bg-pirrot-blue-50 text-info-950 relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded border border-white/50 px-4 py-2 transition-colors duration-500 hover:animate-pulse disabled:cursor-not-allowed disabled:opacity-50"
        >
          {makeConfig.isPending ? "Wird erstellt..." : "Weiter"} <ArrowRight />
        </button>
      </div>
    </form>
  );
}
