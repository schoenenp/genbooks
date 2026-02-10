"use client";
import prices from "@/util/prices";

import {
  ArrowLeft,
  ArrowRight,
  BookA,
  BookImage,
  CalendarDays,
  CheckIcon,
  ChevronDown,
  CloudUpload,
  Component,
  EyeIcon,
  Filter,
  FilterIcon,
  InfoIcon,
  ListCollapse,
  LoaderCircle,
  PenBox,
  SaveIcon,
  ShellIcon,
  XIcon,
} from "lucide-react";
import Modal from "./modal";
import LoginPromptModal from "./login-prompt-modal";
import { useCallback, useMemo, useEffect, useState } from "react";
import { api } from "@/trpc/react";
import LoadingSpinner from "./loading-spinner";
import ModuleItem, { type ModulePickerItem } from "./module-item";
import ModuleChanger, { type ColorCode, type ModuleId } from "./module-changer";
import {
  processPdfModules,
  processPdfModulesPreview,
} from "@/util/pdf/converter";
import { motion } from "framer-motion";
import Link from "next/link";

import { useModuleState, type ConfigModules } from "@/hooks/use-module-state";
import { useFilterState } from "@/hooks/use-filter-state";
import { useUIState } from "@/hooks/use-ui-state";
import { useBookConfig } from "@/hooks/use-book-config";

import { FilterButton, type FilterItem } from "./filter-button";
import { ToggleSwitch } from "./toggle-switch";
import { SearchInput } from "./search-input";

import Image from "next/image";

import UserModules from "../config/_components/_user/modules";
import { getBookPart } from "@/util/book/functions";
import Login from "../config/_components/_user/login-form";
import ModuleCarousel from "./module-carousel";
import { useRouter } from "next/navigation";
import ConfigInfoForm from "./config-info-form";
import CustomDatesForm from "./custom-dates-form";
import { calculatePrintCost } from "@/util/pdf/calculator";
import ConfigOrderForm from "./config-payment-form";

export type ConfigBookPart = keyof ConfigModules;

const GRID_SLICE_SIZES = {
  both: 8,
  single: 11,
  default: 14,
} as const;

export const FILTER_TYPES = {
  COVER: "umschlag",
  PLANNER: "wochenplaner",
  BINDING: "bindung",
  CUSTOM: "custom",
} as const;

function getGridColumns(
  isFilterOpen: boolean,
  isBookInfoOpen: boolean,
): string {
  if (isFilterOpen && isBookInfoOpen) return "grid-cols-2 xl:grid-cols-3";
  if (isFilterOpen || isBookInfoOpen)
    return "grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-4";
  return "grid-cols-2 xl:grid-cols-5";
}

function getCurrentSlice(
  isFilterOpen: boolean,
  isBookInfoOpen: boolean,
): number {
  if (isFilterOpen && isBookInfoOpen) return GRID_SLICE_SIZES.both;
  if (isFilterOpen || isBookInfoOpen) return GRID_SLICE_SIZES.single;
  return GRID_SLICE_SIZES.default;
}

// Main component
export default function BookConfig(props: {
  bookId?: string;
  isLoggedIn?: boolean;
}) {
  const { bookId, isLoggedIn } = props;
  const router = useRouter();

  const {
    modules,
    book: existingBook,
    types: existingTypes,
    tips: existingTips,
  } = useBookConfig(bookId);

  const {
    data: userModules,
    error: userModulesError,
    isLoading: userModulesLoading,
  } = api.module.getUserModules.useQuery(undefined, {
    retry: 0,
    retryOnMount: false,
  });

  const {
    nameInput,
    setNameInput,
    pickedFormat,
    setPickedFormat,
    previewPrice,
    setPreviewPrice,
    orderAmount,
    setOrderAmount,
    pickedModules,
    setPickedModules,
    totalPagesCount,
    setTotalPagesCount,
    isMakingPreview,
    setIsMakingPreview,
  } = useModuleState({
    name: existingBook?.name,
    modules: existingBook?.modules.map((m) => ({
      id: m.moduleId,
      idx: m.idx,
      part: m.module.part,
      color: m.colorCode === "COLOR" ? 4 : 1,
    })),
  });

  const {
    modalId,
    setModalId,
    acceptPolicies,
    setAcceptPolicies,
    acceptPoliciesValid,
    isFilterOpen,
    setIsFilterOpen,
    isBookInfoOpen,
    setIsBookInfoOpen,
    configWarnings,
    setConfigWarnings,
    previewFileURL,
    setPreviewFileURL,
    isCostOpen,
    setIsCostOpen,
    onlyPickedModules,
    setOnlyPickedModules,
  } = useUIState();

  useEffect(() => {
    return () => {
      if (previewFileURL) {
        URL.revokeObjectURL(previewFileURL);
      }
    };
  }, [previewFileURL]);

  const {
    filterValues,
    setFilterValues,
    searchFilterValue,
    setSearchFilterValue,
    handleFilterValues,
    clearSearch,
  } = useFilterState();

  function handleCategorySwitch(val: string) {
    if (filterValues.includes(val)) {
      setFilterValues([]);
    } else {
      setFilterValues([val]);
      setIsFilterOpen(true);
    }
  }

  const [moduleColorMap, setModuleColorMap] = useState<
    Map<ModuleId, ColorCode>
  >(() => {
    const newMap = new Map();
    if (existingBook?.modules) {
      for (const moduleItem of existingBook.modules) {
        newMap.set(
          moduleItem.moduleId,
          moduleItem.colorCode === "COLOR" ? 4 : 1,
        );
      }
    }
    return newMap;
  });

  // API mutations
  const utils = api.useUtils();
  const { mutate: updateName } = api.book.updatePlannerName.useMutation({
    onSuccess: async (data) => {
      await utils.config.init.invalidate({ bookId });
      setNameInput(data.name);
      setModalId(undefined);
    },
  });

  const { mutate: saveConfigModules, isPending: isSavingConfig } =
    api.book.saveBookModules.useMutation({
      onSuccess: async () => {
        await utils.book.getById.invalidate({ id: bookId });
        router.refresh();
      },
    });

  function getUniqueThemes(modules: ModulePickerItem[]) {
    return Array.from(
      new Set(
        modules
          .map((m) => m.theme)
          .filter((theme) => theme && theme !== "custom"),
      ),
    );
  }

  const uniqueThemes = getUniqueThemes(modules);

  // Computed values
  const modulesByType = useMemo(() => {
    const idToModule = new Map(modules.map((m) => [m.id, m]));
    const toOrdered = (ids: string[]) =>
      ids
        .map((id) => idToModule.get(id))
        .filter((m): m is (typeof modules)[number] => Boolean(m));

    return {
      cover: toOrdered(pickedModules.COVER),
      planner: toOrdered(pickedModules.MODULES),
      settings: toOrdered(pickedModules.SETTINGS),
    };
  }, [modules, pickedModules]);

  const completionStatus = useMemo(
    () => ({
      hasCoverModule: modulesByType.cover.some(
        (m) => m.type.toLowerCase() === FILTER_TYPES.COVER,
      ),
      hasPlannerModule: modulesByType.planner.some(
        (m) => m.type.toLowerCase() === FILTER_TYPES.PLANNER,
      ),
      hasCustomModule: [...modulesByType.planner, ...modulesByType.cover].some(
        (m) => m.type.toLowerCase() === FILTER_TYPES.CUSTOM,
      ),
      hasBindingModule: modulesByType.settings.some(
        (m) => m.type.toLowerCase() === FILTER_TYPES.BINDING,
      ),
    }),
    [modulesByType],
  );

  const filterGroups: FilterItem[] = [
    {
      id: "Umschläge",
      filterValue: FILTER_TYPES.COVER,
      isComplete: completionStatus.hasCoverModule,
    },
    {
      id: "Wochenplaner",
      filterValue: FILTER_TYPES.PLANNER,
      isComplete: completionStatus.hasPlannerModule,
    },
    {
      id: "Bindungen",
      filterValue: FILTER_TYPES.BINDING,
      isComplete: completionStatus.hasBindingModule,
    },
  ];

  const moduleFilter = useCallback(
    (mod: ModulePickerItem): boolean => {
      if (!mod) return false;

      const normalizedSearch = searchFilterValue?.trim().toLowerCase() ?? "";
      const hasSearch = normalizedSearch.length > 0;
      const hasFilters = (filterValues?.length ?? 0) > 0;
      const hasPickedFilter = onlyPickedModules && pickedModules;

      if (hasPickedFilter) {
        const isModulePicked = pickedModules[getBookPart(mod.type)]?.includes(
          mod.id,
        );
        if (!isModulePicked) return false;
      }

      if (!hasSearch && !hasFilters) return true;

      const modFields: Record<ModFieldKey, string> = {
        name: mod.name?.toLowerCase() ?? "",
        type: mod.type?.toLowerCase() ?? "",
        theme: mod.theme?.toLowerCase() ?? "",
      };

      const searchableFields = ["name", "type", "theme"] as const;
      type ModFieldKey = (typeof searchableFields)[number];

      const matchesSearch =
        !hasSearch ||
        searchableFields.some((field) =>
          modFields[field].includes(normalizedSearch),
        );

      const matchesFilters = !hasFilters
        ? true
        : filterValues.every((val) => {
            const normalizedVal = val?.trim().toLowerCase() ?? "";
            if (!normalizedVal) return true;
            return searchableFields.some(
              (field) => modFields[field] === normalizedVal,
            );
          });

      return matchesSearch && matchesFilters;
    },
    [searchFilterValue, filterValues, onlyPickedModules, pickedModules],
  );

  const filteredModules = modules.filter(moduleFilter);

  /** HANDLERS  */

  const handleNameSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!bookId || !nameInput) return;
    updateName({ id: bookId, name: nameInput });
  };

  function handleCoverModule(id: string) {
    setPickedModules((prev) => ({
      ...prev,
      COVER: [id],
    }));
  }

  function handleBindingModule(id: string) {
    setPickedModules((prev) => ({
      ...prev,
      SETTINGS: [id],
    }));
  }

  function handlePlannerModule(id: string, type: string) {
    const currentPlanner = modulesByType.planner.find((p) => p.type === type);
    const withoutPlanner = pickedModules.MODULES.filter(
      (m) => m !== currentPlanner?.id,
    );

    setPickedModules((prev) => ({
      ...prev,
      MODULES: [...withoutPlanner, id],
    }));
  }

  function handleRegularModule(
    id: string,
    bookPart: string,
    currentModules: string[],
    isAlreadyPicked: boolean,
  ) {
    setPickedModules((prev) => ({
      ...prev,
      [bookPart]: isAlreadyPicked
        ? currentModules.filter((m) => m !== id)
        : [...currentModules, id],
    }));
  }

  function handlePickedItem(pickedItem: { id: string; type: string }) {
    const { id, type } = pickedItem;

    const bookPart = getBookPart(type);
    const currentModules = pickedModules[bookPart] ?? [];
    const isAlreadyPicked = currentModules.includes(id);

    const isCoverModule = type.toLowerCase() === "umschlag";
    const isBindingModule = type.toLowerCase() === "bindung";
    const isPlannerModule = type.toLowerCase() === "wochenplaner";

    if (isCoverModule && completionStatus.hasCoverModule) {
      handleCoverModule(id);
    } else if (isBindingModule && completionStatus.hasBindingModule) {
      handleBindingModule(id);
    } else if (isPlannerModule && completionStatus.hasPlannerModule) {
      handlePlannerModule(id, type);
    } else {
      handleRegularModule(id, bookPart, currentModules, isAlreadyPicked);
    }

    if (!isAlreadyPicked) {
      setIsBookInfoOpen(true);
    }
  }

  async function handleSummaryView() {
    const coverModule = modules.find((m) => m.id === pickedModules.COVER[0]);
    const pdfUrls = pickedModules.MODULES.map((moduleId, idx) => {
      const moduleItem = modules.find((m) => m.id === moduleId);
      return {
        idx,
        id: moduleId,
        type: moduleItem?.type.toLowerCase() ?? "sonstige",
        pdfUrl: moduleItem?.url ?? "notizen.pdf",
      };
    });

    const pdfModules = [
      ...pdfUrls,
      {
        id: coverModule?.id ?? "",
        idx: 12345,
        type: FILTER_TYPES.COVER,
        pdfUrl: coverModule?.url ?? "",
      },
    ];

    try {
      setPreviewFileURL(undefined);
      setIsMakingPreview(true);
      setModalId("summary");

      const result = await processPdfModules(
        {
          title: existingBook?.bookTitle ?? "Hausaufgaben",
          period: {
            start: existingBook?.planStart,
            end: existingBook?.planEnd ?? undefined,
          },
          code: existingBook?.region ?? "DE-SL",
          country: existingBook?.country ?? "DE",
          addHolidays: true,
          customDates: (existingBook?.customDates ?? []).map((d) => ({
            date: new Date(d.date).toISOString().split("T")[0]!,
            name: d.name,
          })),
        },
        pdfModules,
        {
          addWatermark: true,
          compressionLevel: "high",
          colorMap: moduleColorMap,
        },
      );

      console.log("PDF PREVIEW RESULT: ", result);

      // Create preview URL
      const blob = new Blob([result.pdfFile as BlobPart], {
        type: "application/pdf",
      }); // console.log("PREFLIGHT RESULT: ", preflightResult)
      const estimatedCost = calculatePrintCost({
        amount: orderAmount,
        bPages: result.details.bPages,
        cPages: result.details.cPages,
        format: pickedFormat,
        prices,
      });

      setPreviewPrice(estimatedCost);
      const url = URL.createObjectURL(blob);
      setPreviewFileURL(url);
      setTotalPagesCount(
        result.details.fullPageCount ?? result.details.pageCount ?? 0,
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const warning = handleWarningText(errorMessage);
      setConfigWarnings((prev) => [...prev, warning]);
      setIsMakingPreview(false);
    } finally {
      setIsMakingPreview(false);
    }
    // MAKE MORE HERE
  }

  function handleModuleDetailBG(modType: string) {
    let moduleTypeBgClass;
    switch (modType) {
      case "bindung":
        moduleTypeBgClass = "bg-warning-300/20";
        break;
      case "wochenplaner":
        moduleTypeBgClass = "bg-pirrot-green-300/20";
        break;
      default:
        moduleTypeBgClass = "bg-pirrot-red-400/20";
        break;
    }
    return moduleTypeBgClass;
  }

  const handleRefreshPrice = async () => {
    const coverModule = modules.find((m) => m.id === pickedModules.COVER[0]);
    const pdfUrls = pickedModules.MODULES.map((moduleId, idx) => {
      const moduleItem = modules.find((m) => m.id === moduleId);
      return {
        idx,
        id: moduleId,
        type: moduleItem?.type.toLowerCase() ?? "sonstige",
        pdfUrl: moduleItem?.url ?? "notizen.pdf",
      };
    });

    const pdfModules = [
      ...pdfUrls,
      {
        id: coverModule?.id ?? "",
        idx: 12345,
        type: FILTER_TYPES.COVER,
        pdfUrl: coverModule?.url ?? "",
      },
    ];

    try {
      setPreviewFileURL(undefined);
      setIsMakingPreview(true);
      // setModalId("preview")

      const result = await processPdfModulesPreview(
        {
          title: existingBook?.bookTitle ?? "Hausaufgaben",
          period: {
            start: existingBook?.planStart,
            end: existingBook?.planEnd ?? undefined,
          },
          code: existingBook?.region ?? "DE-SL",
          country: existingBook?.country ?? "DE",
          addHolidays: true,
          customDates: (existingBook?.customDates ?? []).map((d) => ({
            date: new Date(d.date).toISOString().split("T")[0]!,
            name: d.name,
          })),
        },
        pdfModules,
        {
          compressionLevel: "high",
          colorMap: moduleColorMap,
        },
      );

      console.log("PDF PREVIEW RESULT: ", result);

      // Create preview URL
      const blob = new Blob([result.pdfFile as BlobPart], {
        type: "application/pdf",
      }); // const preflightResult = await preflightDocument(blob)

      // console.log("PREFLIGHT RESULT: ", preflightResult)
      const estimatedCost = calculatePrintCost({
        amount: orderAmount,
        bPages: result.details.bPages,
        cPages: result.details.cPages,
        format: pickedFormat,
        prices,
      });
      console.log("FULL_PAGE COUNT: ", result.details.fullPageCount);
      setPreviewPrice(estimatedCost);
      const url = URL.createObjectURL(blob);
      setPreviewFileURL(url);
      setTotalPagesCount(
        result.details.fullPageCount ?? result.details.pageCount ?? 0,
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const warning = handleWarningText(errorMessage);
      setConfigWarnings((prev) => [...prev, warning]);
      setIsMakingPreview(false);
    } finally {
      setIsMakingPreview(false);
    }
  };
  function handleWarningText(text: string): string {
    let warningText = "Fehler beim erstellen der PDF";
    switch (true) {
      case text.toLocaleLowerCase().includes("cover"):
        warningText = configWarningTexts.cover;
        break;
      case text.toLocaleLowerCase().includes("planner"):
        warningText = configWarningTexts.planner;
        break;
      default:
        break;
    }
    return warningText;
  }

  function handleSaveConfig(event?: React.MouseEvent<HTMLButtonElement>): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!bookId) {
      return;
    }

    saveConfigModules({
      bookId,
      modules: [
        ...pickedModules.COVER.map((c) => ({
          id: c,
          idx: 0,
          colorCode: moduleColorMap.get(c),
        })),
        ...pickedModules.MODULES.map((c, i) => ({
          id: c,
          idx: i + 1,
          colorCode: moduleColorMap.get(c),
        })),
        ...pickedModules.SETTINGS.map((c) => ({ id: c, idx: -1 })),
      ],
    });
  }

  const orderSummary = {
    bookId,
    amount: orderAmount,
    planerPages: totalPagesCount,
    format: pickedFormat,
    price: previewPrice.total,
    single: previewPrice.single,
    pickedModuleDetails: modulesByType,
  } as const;

  // Modal content
  const renderModalContent = () => {
    switch (modalId) {
      case "login-prompt":
        return null;

      case "info":
        return (
          <div className="text-info-950 bg-pirrot-blue-50 w-full max-w-xl rounded p-2">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold">Planerinfo</h3>
              <button
                type="button"
                onClick={() => setModalId(undefined)}
                className="bg-pirrot-red-200 text-pirrot-blue-50 rounded p-2"
              >
                <XIcon className="size-6" />
              </button>
            </div>
            <ConfigInfoForm
              onAbortForm={() => setModalId(undefined)}
              initialFormState={
                existingBook
                  ? {
                      id: existingBook.id,
                      name: existingBook.bookTitle,
                      sub: existingBook.subTitle,
                      country: existingBook.country,
                      region: existingBook?.region,
                      period: {
                        start: existingBook.planStart
                          .toISOString()
                          .slice(0, 16),
                        end: existingBook?.planEnd?.toISOString().slice(0, 16),
                      },
                    }
                  : undefined
              }
            />
          </div>
        );

      case "dates":
        return (
          <div className="text-info-950 bg-pirrot-blue-50 w-full max-w-xl rounded p-2">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold">Eigene Termine</h3>
              <button
                type="button"
                onClick={() => setModalId(undefined)}
                className="bg-pirrot-red-200 text-pirrot-blue-50 rounded p-2"
              >
                <XIcon className="size-6" />
              </button>
            </div>
            <CustomDatesForm bookId={bookId!} />
          </div>
        );

      case "payment":
        return (
          <div className="text-info-950 bg-pirrot-blue-50 h-full w-full max-w-5xl overflow-y-auto rounded p-2 lg:h-auto">
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-2xl font-bold">Zahlung</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalId("summary")}
                  className="bg-pirrot-red-200 text-pirrot-blue-50 flex gap-2 rounded p-2"
                >
                  <ArrowLeft className="size-6" /> Übersicht
                </button>
                <button
                  type="button"
                  onClick={() => setModalId(undefined)}
                  className="bg-pirrot-red-200 text-pirrot-blue-50 rounded p-2"
                >
                  <XIcon className="size-6" />
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-bold">Zahlungsabwicklung</h2>
              <p className="w-full max-w-xl">
                Bitte geben Sie nun Ihre Daten ein, damit wir Ihre Bestellung
                bearbeiten können. Wir leiten Sie dann zum Zahlungsprozess
                weiter.
              </p>
              {!!bookId && (
                <ConfigOrderForm
                  bookId={bookId}
                  quantity={orderSummary.amount}
                  format={orderSummary.format}
                  onAbortForm={() => setModalId("summary")}
                />
              )}
            </div>
          </div>
        );
      case "summary":
        function handleFinishOrder(event: React.MouseEvent<HTMLButtonElement>) {
          event.preventDefault();
          event.stopPropagation();
          handleSaveConfig(event);
          console.log(orderSummary);
          setModalId("payment");
        }

        return (
          <div className="text-info-950 bg-pirrot-blue-50 h-full w-full max-w-[95vw] overflow-y-auto rounded p-2 lg:h-auto">
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-2xl font-bold">Übersicht</h3>
              <button
                type="button"
                onClick={() => setModalId(undefined)}
                className="bg-pirrot-red-200 text-pirrot-blue-50 rounded p-2"
              >
                <XIcon className="size-6" />
              </button>
            </div>
            <div className="flex h-full flex-col gap-4 lg:flex-row">
              {/* LEFT: Order Details */}
              <div className="flex flex-1 flex-col gap-4">
                <h2 className="text-xl font-bold">Bestellungsübersicht</h2>
                <p className="w-full max-w-xl">
                  Fast geschafft! Bitte überprüfen Sie die Zusammenfassung Ihrer
                  Bestellung. Wenn alle Angaben korrekt sind, können Sie im
                  nächsten Schritt die Zahlung abschließen.
                </p>
                <div className="bg-pirrot-blue-100/20 border-pirrot-blue-300/5 rounded border p-2">
                  <ul className="space-y-1">
                    <li>
                      <b>Buchname:</b> {nameInput ?? "Unbenanntes Buch"}
                    </li>
                    <li>
                      <b>Format:</b> {orderSummary.format}
                    </li>
                    <li>
                      <b>Stückzahl:</b> {orderSummary.amount}x
                    </li>
                    <li>
                      <b>Seiten gesamt:</b> {orderSummary.planerPages}
                    </li>
                    <li>
                      <b>Einzelpreis:</b>{" "}
                      {(orderSummary.single / 100).toFixed(2)} €
                    </li>
                    <li>
                      <b>Gesamtpreis:</b>{" "}
                      {(orderSummary.price / 100).toFixed(2)} €
                    </li>
                  </ul>
                </div>
                <div className="inline-block flex-1 p-1 lg:hidden">
                  {previewFileURL ? (
                    <div className="aspect-square h-full w-full lg:aspect-auto">
                      <iframe
                        src={previewFileURL + "#view=fit"}
                        title="PDF Preview"
                        width="100%"
                        height="100%"
                        className="bg-pirrot-blue-950/10 border-info-950/5 border"
                      />
                    </div>
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-4">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <h5 className="text-2xl">
                          PDF Dokument wird erstellt...
                        </h5>
                        <p>
                          <b className="uppercase">info:</b> Dieser Vorgang kann
                          einige Minuten dauern.
                        </p>
                      </div>
                      <LoadingSpinner />
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <h4 className="mb-2 font-bold">Ausgewählte Module:</h4>
                  <div className="flex gap-4">
                    <ul className="border-info-950/5 bg-pirrot-blue-950/5 max-h-68 flex-1 space-y-2 overflow-y-auto rounded border-b p-1 py-2">
                      {orderSummary.pickedModuleDetails?.planner.length ===
                        0 && (
                        <li className="text-gray-500 italic">
                          Keine Module ausgewählt.
                        </li>
                      )}
                      {orderSummary.pickedModuleDetails?.planner.map(
                        (mod, idx) => (
                          <li
                            key={idx}
                            className="border-info-950/10 flex flex-wrap items-center gap-2 border-b py-2"
                          >
                            <span className="font-semibold">{mod.name}</span>
                            <span
                              className={`text-xs first-letter:uppercase ${handleModuleDetailBG(mod.type)} rounded px-2 py-0.5`}
                            >
                              {mod.type}
                            </span>
                            {mod.theme && (
                              <span className="bg-pirrot-blue-50 rounded px-2 py-0.5 text-xs first-letter:uppercase">
                                {mod.theme}
                              </span>
                            )}
                          </li>
                        ),
                      )}
                    </ul>
                    <div className="flex flex-col gap-4">
                      <div className="border-pirrot-blue-500/10 bg-pirrot-blue-300/20 flex aspect-square w-32 flex-col gap-4 rounded border p-1">
                        <div className="flex justify-between">
                          <BookImage />
                          <h3
                            className={`bg-pirrot-blue-300/20 flex items-center justify-center rounded px-2 py-0.5 text-xs first-letter:uppercase`}
                          >
                            Umschlag
                          </h3>
                        </div>
                        <div className="mt-auto flex flex-col gap-2">
                          <h5 className="text-sm font-semibold">
                            {orderSummary.pickedModuleDetails?.cover[0]?.name}
                          </h5>
                          <h5 className="bg-pirrot-blue-50 rounded px-2 py-0.5 text-xs first-letter:uppercase">
                            {orderSummary.pickedModuleDetails?.cover[0]?.theme}
                          </h5>
                        </div>
                      </div>
                      <div className="border-warning-500/10 bg-warning-300/20 flex aspect-square w-32 flex-col gap-2 rounded border p-1">
                        <div className="flex justify-between">
                          <ShellIcon />
                          <h3
                            className={`bg-warning-300/20 flex items-center justify-center rounded px-2 py-0.5 text-xs first-letter:uppercase`}
                          >
                            Bindung
                          </h3>
                        </div>
                        <div className="mt-auto flex flex-col gap-2">
                          <h5 className="text-sm font-semibold">
                            {
                              orderSummary.pickedModuleDetails?.settings[0]
                                ?.name
                            }
                          </h5>
                          <h5 className="bg-pirrot-blue-50 rounded px-2 py-0.5 text-xs first-letter:uppercase">
                            {
                              orderSummary.pickedModuleDetails?.settings[0]
                                ?.theme
                            }
                          </h5>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    <div className="text-info-950 flex w-full items-center gap-2">
                      <input
                        id="agb"
                        type="checkbox"
                        checked={acceptPolicies.agb}
                        onChange={() =>
                          setAcceptPolicies((prev) => ({
                            ...prev,
                            agb: !prev.agb,
                          }))
                        }
                        className="mr-2"
                      />
                      <label htmlFor="agb" className="font-cairo">
                        Allgemeine Geschäftsbedingungen.
                      </label>
                    </div>
                    <div className="text-info-950 flex w-full items-center gap-2">
                      <input
                        id="data"
                        type="checkbox"
                        checked={acceptPolicies.data}
                        onChange={() =>
                          setAcceptPolicies((prev) => ({
                            ...prev,
                            data: !prev.data,
                          }))
                        }
                        className="mr-2"
                      />
                      <label htmlFor="data" className="font-cairo">
                        Datenschutzeinwilligung.
                      </label>
                    </div>
                    <div>
                      <button
                        type="button"
                        disabled={!acceptPoliciesValid}
                        onClick={handleFinishOrder}
                        className="border-pirrot-blue-300/10 bg-pirrot-blue-100/20 flex gap-2 rounded border p-2 font-bold disabled:opacity-25"
                      >
                        Abschließen
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* RIGHT: PDF Preview */}
              <div className="hidden flex-1 items-center justify-center p-1 lg:flex">
                {previewFileURL ? (
                  <div className="flex h-full max-h-[85vh] w-full">
                    <iframe
                      src={previewFileURL}
                      title="PDF Preview"
                      width="100%"
                      height="100%"
                      className="border-info-950/5 border"
                    />
                  </div>
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-4">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <h5 className="text-2xl">
                        PDF Dokument wird erstellt...
                      </h5>
                      <p>
                        <b className="uppercase">info:</b> Dieser Vorgang kann
                        einige Minuten dauern.
                      </p>
                    </div>
                    <LoadingSpinner />
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case "preview":
        return (
          <div className="text-info-950 bg-pirrot-blue-50 w-full max-w-[90vw] rounded p-2">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold">Vorschau</h3>
              <button
                type="button"
                onClick={() => setModalId(undefined)}
                className="bg-pirrot-red-200 text-pirrot-blue-50 rounded p-2"
              >
                <XIcon className="size-6" />
              </button>
            </div>
            <div className="h-[85vh] w-full p-1">
              {previewFileURL ? (
                <iframe
                  src={previewFileURL}
                  title="PDF Preview"
                  width="100%"
                  height="100%"
                  className="border-info-950/5 border"
                />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-4">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <h5 className="text-2xl">PDF Dokument wird erstellt...</h5>
                    <p>
                      <b className="uppercase">info:</b> Dieser Vorgang kann
                      einige Minuten dauern.
                    </p>
                  </div>
                  <LoadingSpinner />
                </div>
              )}
            </div>
          </div>
        );

      case "name":
        return (
          <div className="text-info-950 bg-pirrot-blue-50 z-[69] w-full max-w-xl rounded p-2">
            <form onSubmit={handleNameSubmit}>
              <div className="flex flex-col gap-2">
                <label className="font-bold">Projekt Name</label>
                <div className="flex gap-2">
                  <input
                    className="bg-pirrot-blue-950/10 w-full rounded p-2"
                    onChange={(e) => setNameInput(e.target.value)}
                    value={nameInput ?? ""}
                  />
                  <button
                    type="submit"
                    className="bg-pirrot-green-200 text-pirrot-blue-50 rounded p-2"
                  >
                    <CheckIcon className="size-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalId(undefined)}
                    className="bg-pirrot-red-200 text-pirrot-blue-50 rounded p-2"
                  >
                    <XIcon className="size-6" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        );

      default:
        return <LoadingSpinner />;
    }
  };

  const isConfigComplete = useMemo(
    () =>
      pickedModules.COVER.length === 1 &&
      pickedModules.MODULES.length >= 1 &&
      completionStatus.hasPlannerModule &&
      completionStatus.hasBindingModule,
    [pickedModules, completionStatus],
  );

  function handleConfigWarning(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const warnId = event.currentTarget.id.split("-")[1];
    const filteredWarnings = configWarnings.filter(
      (_, idx) => idx !== Number(warnId),
    );
    setConfigWarnings(filteredWarnings);
  }

  if (!existingBook) {
    return (
      <div
        className={`${modalId !== undefined && "blur"} relative flex h-screen w-full flex-col items-center justify-center gap-8 overflow-hidden`}
      >
        <h2 className="text-pirrot-red-400 text-2xl font-bold">
          Kein Buch gefunden.
        </h2>
        <p className="w-full max-w-xl">
          Unsere Suche hat leider für Sie keine Buchvorschau gefunden. Kehren
          Sie zum Startbildschirm zurück oder loggen Sie sich ein.
        </p>
        <div className="w-full max-w-xl">
          <Login />
        </div>
        <Link
          href="/"
          className="underline underline-offset-4 transition-all duration-300 hover:underline-offset-8"
        >
          ← Zurück zum Anfang
        </Link>
      </div>
    );
  }
  return (
    <>
      <div
        className={`${modalId !== undefined && "blur"} relative flex h-screen w-full flex-col justify-between overflow-hidden md:flex-row`}
      >
        {/* LEFT SIDEBAR */}
        <div
          className={`${isFilterOpen ? "sticky top-0 md:w-xs" : ""} bg-pirrot-blue-200 border-pirrot-blue-950/10 relative flex flex-col gap-2 overflow-y-auto border-b md:h-screen lg:border-r`}
        >
          <div className="p-2">
            <Filter
              className="size-9 cursor-pointer"
              onClick={() => setIsFilterOpen((prev) => !prev)}
            />
          </div>

          {isFilterOpen && (
            <div className="flex w-full flex-col gap-2">
              <SearchInput
                value={searchFilterValue}
                onChange={setSearchFilterValue}
                onClear={clearSearch}
              />

              <ToggleSwitch
                checked={onlyPickedModules}
                onChange={setOnlyPickedModules}
                label="Nur ausgewählte Module"
              />

              <div>
                <h3 className="px-1">Aktive Filter:</h3>
                <div className="flex w-full max-w-xl flex-wrap gap-1 p-1 lg:max-w-xs">
                  {filterValues.map((f, i) => (
                    <span
                      key={i}
                      className="bg-pirrot-blue-50 cursor-pointer truncate rounded-full border border-white/50 p-1 px-4 text-center text-sm first-letter:uppercase"
                      onClick={() => handleFilterValues(f)}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              <div className="w-full">
                <h3 className="px-1">Nach Kategorie:</h3>
                <div className="flex w-full max-w-xl flex-wrap gap-1 p-1 lg:max-w-xs">
                  {existingTypes.map((t, i) => (
                    <span
                      key={i}
                      className="bg-pirrot-blue-50 cursor-pointer truncate rounded-full border border-white/50 p-1 px-4 text-center text-sm first-letter:uppercase"
                      onClick={() => handleFilterValues(t.name)}
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="w-full">
                <h3 className="px-1">Themes:</h3>
                <div className="flex flex-wrap gap-1 p-1">
                  {uniqueThemes.map((t, i) => (
                    <span
                      key={i}
                      className="bg-pirrot-blue-50 cursor-pointer truncate rounded-full border border-white/50 p-1 px-4 text-center text-sm first-letter:uppercase"
                      onClick={() => handleFilterValues(t ?? "")}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MAIN CONTENT */}
        <div className="flex w-full max-w-screen-2xl flex-[5] flex-col gap-12 overflow-y-auto">
          <div className="flex w-full flex-col gap-12 lg:p-4">
            {/* HEADER */}
            <div className="bg-pirrot-blue-50 sticky top-0 z-[59] flex w-full flex-col justify-start gap-4 p-1 pb-2 lg:justify-between">
              <div className="pb-3">
                <Link
                  href="/"
                  className="underline underline-offset-4 transition-all duration-300 hover:underline-offset-8"
                >
                  ← Zurück zum Anfang
                </Link>
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setModalId("name")}
                  className="font-cairo flex items-center gap-4 text-3xl font-bold lg:text-5xl"
                >
                  {nameInput} <PenBox className="size-9" />
                </button>
                <button
                  type="button"
                  onClick={() => setModalId("info")}
                  className="flex items-center gap-4 text-3xl"
                >
                  <span className="hidden sm:block">Planerinfo</span>{" "}
                  <InfoIcon className="size-9" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setModalId(isLoggedIn ? "dates" : "login-prompt")
                  }
                  className="flex items-center gap-4 text-3xl"
                >
                  <span className="hidden sm:block">Termine</span>{" "}
                  <CalendarDays className="size-9" />
                </button>
              </div>

              <hr className="w-full rounded-full border border-white/50" />

              <div className="flex w-full justify-between gap-2 lg:gap-4">
                <button
                  onClick={() => setIsFilterOpen((prev) => !prev)}
                  className="bg-pirrot-blue-950/10 text-pirrot-blue-950 rounded p-2"
                >
                  <FilterIcon />
                </button>

                <div className="flex w-full items-center justify-between gap-2 md:gap-4">
                  {filterGroups.map((item) => (
                    <FilterButton
                      key={item.id}
                      item={item}
                      isActive={filterValues.includes(item.filterValue)}
                      onToggle={() => handleCategorySwitch(item.filterValue)}
                    />
                  ))}
                </div>

                <button
                  onClick={() => setIsBookInfoOpen((prev) => !prev)}
                  className="bg-pirrot-blue-950/10 text-pirrot-blue-950 rounded p-2"
                >
                  <BookA />
                </button>
              </div>
            </div>

            {/* MODULE SELECTION */}
            <div className="flex flex-col gap-4">
              {/* HERO SECTION */}
              <div className="relative size-full h-96 rounded">
                <Image
                  className="size-full rounded object-cover"
                  src="https://picsum.photos/seed/69420/1200/600"
                  fill
                  priority
                  alt="hero"
                />
              </div>
              <div className="flex items-center justify-between py-8">
                <div className="flex flex-col gap-2 p-1">
                  <h3 className="text-2xl font-bold">Die neusten Module</h3>
                  <p className="w-full max-w-xl">
                    Hallo! Willkommen bei unserem Buchkonfigurator. Hier können
                    Sie Ihr ganz persönliches Buch nach Ihren Wünschen
                    gestalten. Lassen Sie Ihrer Kreativität freien Lauf und
                    erschaffen Sie ein einzigartiges Werk, das genau Ihren
                    Vorstellungen entspricht.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <ListCollapse className="size-28" />
                </div>
              </div>

              <div
                className={`grid gap-4 p-1 ${getGridColumns(isFilterOpen, isBookInfoOpen)}`}
              >
                <Link
                  href="#custom"
                  className={`border-pirrot-blue-50 group bg-pirrot-blue-950/5 relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded border shadow-xs select-none`}
                >
                  <CloudUpload className="size-9" />
                  <h3 className="font-bold">Modul hochladen</h3>
                </Link>

                {filteredModules
                  .slice(0, getCurrentSlice(isFilterOpen, isBookInfoOpen))
                  .map((m) => (
                    <ModuleItem
                      key={m.id}
                      isPicked={pickedModules[getBookPart(m.type)]?.includes(
                        m.id,
                      )}
                      item={m}
                      onPickedItem={handlePickedItem}
                    />
                  ))}
              </div>
            </div>

            <ModuleCarousel
              title="Beliebte Covers"
              description="Jetzt ist es an der Zeit, den Umschlag für Ihr Buch zu gestalten. Der
  Umschlag ist das Erste, was man von Ihrem Buch sieht, und prägt den
  entscheidenden ersten Eindruck. Wählen Sie aus unseren hochwertigen
  Materialien und Designs, um Ihr Buch perfekt in Szene zu setzen."
              icon={<BookImage className="size-28" />}
              modules={modules}
              onPickedItem={handlePickedItem}
              pickedModules={pickedModules}
              getBookPart={getBookPart}
              autoplayDelay={10000}
              borderColor="border-pirrot-blue-500/5"
              bgColor="bg-pirrot-blue-300/10"
              iconColor="text-pirrot-blue-300"
              filter={(m) => m.part === "COVER"}
              slice={{ start: 10, end: 20 }}
            />

            {/* CUSTOM MODULES */}
            <div className="scroll-m-40" id="custom"></div>
            <div className="flex flex-col gap-4 py-8">
              <div className="flex flex-col-reverse items-center justify-between py-8 lg:flex-row">
                <div className="flex flex-col gap-2 p-1">
                  <h3 className="text-2xl font-bold text-purple-300">
                    Eigene Module
                  </h3>
                  <p className="w-full max-w-xl">
                    {" "}
                    Ihre Ideen, Ihr Material, Ihr Buch. Der Bereich „Eigene
                    Module“ ist Ihre kreative Werkstatt. Verwandeln Sie Ihre
                    PDF-Dateien (ob Lehrmaterialien, Arbeitsblätter oder
                    persönliche Notizen) in feste Bestandteile Ihres Werkes.
                    Erschaffen Sie einen Planer, der zu Ihrem einzigartigen
                    Bildungsangebot passt.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <CloudUpload className="size-28 text-purple-300" />
                </div>
              </div>

              {userModulesError?.message === "UNAUTHORIZED" && <Login />}
              {!userModulesError && !userModulesLoading && userModules && (
                <UserModules
                  bookId={bookId ?? ""}
                  onPickedUserItem={handlePickedItem}
                  existingTips={existingTips.map((t) => t.title)}
                  pickedModules={pickedModules}
                  userModules={userModules}
                />
              )}
            </div>

            <ModuleCarousel
              title="Beliebte Wochenplaner"
              description="Gestalten Sie hier Ihren individuellen Wochenplaner, der Ihnen hilft, Ihre Termine und Aufgaben stilvoll zu organisieren. Fügen Sie persönliche Elemente hinzu, um den Planer perfekt auf Ihre Bedürfnisse abzustimmen. So wird die Planung Ihrer Woche zu einem kreativen und persönlichen Erlebnis."
              icon={<CalendarDays className="text-pirrot-green-300 size-28" />}
              modules={modules}
              onPickedItem={handlePickedItem}
              pickedModules={pickedModules}
              getBookPart={getBookPart}
              autoplayDelay={10000}
              borderColor="border-pirrot-green-500/5"
              bgColor="bg-pirrot-green-300/10"
              iconColor="text-pirrot-green-300"
              filter={(m) => m.part === "PLANNER"}
              slice={{ start: 10, end: 20 }}
            />

            {/* POPULAR BINDINGS */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between py-8">
                <div className="flex flex-col gap-2 p-1">
                  <h3 className="text-warning-300 text-2xl font-bold">
                    Bindungen
                  </h3>
                  <p className="w-full max-w-xl">
                    Hier können Sie die passende Bindung für Ihr Buch auswählen.
                    Die Wahl der Bindung ist entscheidend für die Langlebigkeit
                    und das Erscheinungsbild Ihres Werkes. Entscheiden Sie sich
                    für die Option, die am besten zu Ihrem Projekt passt.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <ShellIcon className="text-warning-300 size-28" />
                </div>
              </div>
              <div className="overflow-hidden">
                <div className="grid grid-cols-2 gap-4 p-1">
                  {modules
                    .filter((m) => m.part === "BINDING")
                    .slice(0, 2)
                    .map((m) => (
                      <ModuleItem
                        key={m.id}
                        isPicked={pickedModules[getBookPart(m.type)]?.includes(
                          m.id,
                        )}
                        item={m}
                        onPickedItem={handlePickedItem}
                      />
                    ))}
                </div>
              </div>
            </div>

            {/* POPULAR MODULES CAROUSEL */}
            <ModuleCarousel
              title="Beliebte Module"
              description="Gestalten Sie hier Ihren individuellen Wochenplaner, der Ihnen hilft,
  Ihre Termine und Aufgaben stilvoll zu organisieren. Fügen Sie
  persönliche Elemente hinzu, um den Planer perfekt auf Ihre Bedürfnisse
  abzustimmen. So wird die Planung Ihrer Woche zu einem kreativen und
  persönlichen Erlebnis."
              icon={<Component className="text-pirrot-red-300 size-28" />}
              modules={modules}
              onPickedItem={handlePickedItem}
              pickedModules={pickedModules}
              getBookPart={getBookPart}
              autoplayDelay={10000}
              borderColor="border-pirrot-red-500/5"
              bgColor="bg-pirrot-red-300/10"
              iconColor="text-pirrot-red-300"
              filter={(m) =>
                m.part !== "COVER" &&
                m.part !== "PLANNER" &&
                m.type !== "bindung"
              }
              slice={{ start: 10, end: 20 }}
            />
          </div>
        </div>
        {/* RIGHT SIDEBAR */}
        <div
          className={`${isBookInfoOpen ? "h-full lg:w-xs" : ""} bg-pirrot-blue-200 border-pirrot-blue-950/10 relative flex flex-col gap-2 overflow-y-auto border-t md:h-screen lg:border-l`}
        >
          <div className="flex flex-col gap-2">
            <div className="p-2">
              <BookA
                onClick={() => setIsBookInfoOpen((prev) => !prev)}
                className="text-info-950 size-9 cursor-pointer"
              />
            </div>
            {isBookInfoOpen && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2 p-1">
                  <h3 className="font-bold">Stückzahl</h3>
                  <div className="flex gap-2">
                    <input
                      className="bg-pirrot-blue-950/10 w-full rounded p-2"
                      type="number"
                      onChange={(e) => setOrderAmount(+e.target.value)}
                      value={orderAmount}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2 p-1">
                  <h3 className="font-bold">Buch Format</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      id="DIN A5"
                      onClick={(e) =>
                        setPickedFormat(e?.currentTarget.id as "DIN A5")
                      }
                      className={`bg-pirrot-blue-50 flex-1 rounded border p-1 ${pickedFormat === "DIN A5" ? "border-pirrot-blue-700/50 border-2" : "border-white/50"}`}
                    >
                      DIN A5
                    </button>
                    <button
                      type="button"
                      id="DIN A4"
                      onClick={(e) =>
                        setPickedFormat(e?.currentTarget.id as "DIN A4")
                      }
                      className={`bg-pirrot-blue-50 flex-1 rounded border p-1 ${pickedFormat === "DIN A4" ? "border-pirrot-blue-700/50 border-2" : "border-white/50"}`}
                    >
                      DIN A4
                    </button>
                  </div>
                </div>
              </div>
            )}
            {isBookInfoOpen && (
              <div className="bg-pirrot-blue-50 flex flex-col gap-2 p-2">
                <div className="flex justify-between">
                  <h3 className="font-bold">Kosten Übersicht</h3>
                  <motion.button
                    onClick={() => setIsCostOpen((prev) => !prev)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <motion.div
                      animate={{ rotate: isCostOpen ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ChevronDown />
                    </motion.div>
                  </motion.button>
                </div>

                <div
                  className={`bg-pirrot-blue-950/5 ${isCostOpen ? "aspect-video" : "h-9"} rounded p-1 transition-transform duration-300`}
                >
                  <div className="size-full overflow-y-auto transition-transform duration-300">
                    <h3>Seiten gesamt: {totalPagesCount}</h3>
                    <h5>Kosten: {(previewPrice.total / 100).toFixed(2)}€</h5>
                    <h5>
                      pro Planer: {(previewPrice.single / 100).toFixed(2)}€
                    </h5>
                  </div>
                </div>

                <div className="flex w-full justify-between">
                  <button
                    className="bg-pirrot-blue-950/20 hover:bg-pirrot-blue-950/50 flex gap-2 p-2 px-6"
                    type="button"
                    disabled={isMakingPreview}
                    onClick={handleRefreshPrice}
                  >
                    Aktualisieren{" "}
                    {isMakingPreview && (
                      <span className="flex items-center justify-center">
                        <LoaderCircle className="size-4 animate-spin" />
                      </span>
                    )}
                  </button>
                  {previewFileURL && (
                    <button type="button" onClick={() => setModalId("preview")}>
                      <EyeIcon />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {isBookInfoOpen && (
            <div className="flex flex-col">
              <div className="p-1">
                <ModuleChanger
                  items={pickedModules}
                  modules={modules}
                  onItemsChange={(items) => setPickedModules(items)}
                  initialColorMap={moduleColorMap}
                  onColorMapChange={setModuleColorMap}
                />
              </div>
            </div>
          )}

          {isBookInfoOpen && (
            <div className="border-info-950/5 sticky bottom-1 flex w-full gap-2 border-t p-1">
              <button
                disabled={isSavingConfig}
                onClick={handleSaveConfig}
                className="disabled:border-pirrot-blue-300 disabled:text-pirrot-blue-700 disabled:bg-pirrot-blue-100 bg-pirrot-green-100 border-pirrot-green-300 text-pirrot-green-700 flex gap-2 rounded border-2 p-2 font-bold disabled:opacity-25"
              >
                {isSavingConfig ? <LoadingSpinner /> : "Speichern"}{" "}
                <SaveIcon className="size-6" />
              </button>
              <button
                onClick={handleSummaryView}
                disabled={!isConfigComplete}
                className="disabled:border-pirrot-blue-300 disabled:text-pirrot-blue-700 disabled:bg-pirrot-blue-100 bg-pirrot-green-100 border-pirrot-green-300 text-pirrot-green-700 flex gap-2 rounded border-2 p-2 font-bold disabled:opacity-25"
              >
                Weiter <ArrowRight className="size-6" />
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal selector="modal-hook" show={modalId !== undefined}>
        <div className="absolute top-0 left-0 z-[69] flex h-full w-full items-center justify-center">
          <div className="bg-info-950/95 flex size-full items-center justify-center">
            <div className="absolute top-2 right-2 z-[123] w-full p-2">
              {configWarnings.map((w, i) => (
                <button
                  key={i}
                  id={`warning-${i}`}
                  type="button"
                  onClick={handleConfigWarning}
                  style={{ translate: `-${2 * i}px ${2 * i}px ` }}
                  className="border-pirrot-red-500/50 bg-pirrot-red-300 absolute top-2 right-2 flex w-full max-w-xl gap-2 rounded border p-2 text-start shadow-2xs"
                >
                  <XIcon />
                  {w}
                </button>
              ))}
            </div>
            {renderModalContent()}
          </div>
        </div>
      </Modal>

      <LoginPromptModal
        show={modalId === "login-prompt"}
        onClose={() => setModalId(undefined)}
      />
    </>
  );
}

export const configWarningTexts = {
  cover:
    "Umschläge müssen genau 4 Seiten haben. Beachten Sie die Datei größe. (max. 5MB)",
  planner: "",
};
