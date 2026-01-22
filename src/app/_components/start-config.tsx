"use client";

import { EyeIcon, AlertCircle } from "lucide-react";
import { useState } from "react";
import BookPreview from "./book-preview";
import About from "./about";
import PlannerForm from "./planner-form";
import HowItWorks from "./how-it-works";
import TemplateGallery from "./template-gallery";
import Footer from "./footer";
// import FAQ from "./faq"

const currentDate = new Date();
const nextYearDate = new Date(currentDate);
nextYearDate.setFullYear(currentDate.getFullYear() + 1);

export default function StartConfig() {
  const [previewData, setPreviewData] = useState({
    name: "Hausaufgaben",
    sub: "Meine Schule",
    period: {
      start: currentDate.toISOString().slice(0, 16),
      end: nextYearDate.toISOString().slice(0, 16),
    },
  });

  const [isFormValid, setIsFormValid] = useState(false);

  return (
    <div className="flex w-full flex-col items-center justify-center gap-12">
      <h1 className="font-cairo text-pirrot-red-400 flex items-center justify-center gap-4 p-4 text-5xl font-black uppercase lg:text-7xl">
        Schulplaner Generator
      </h1>
      <p className="font-baloo max-w-xl p-4 text-xl lg:text-center">
        Gestalten Sie individuelle Schulplaner mit Hausaufgabenübersicht,
        Stundenplan, Kalender und allen wichtigen Funktionen für den
        Schulalltag.
      </p>
      <HowItWorks />

      <TemplateGallery />

      <div className="bg-pirrot-blue-50 border-red flex min-h-[640px] w-full items-center justify-center p-2 py-12 lg:p-4">
        <div className="grid w-full max-w-screen-xl grid-cols-1 items-center justify-center gap-8 py-12 lg:grid-cols-3">
          <div className="bg-pirrot-blue-50 text-pirrot-blue-50 order-2 col-span-1 flex w-full flex-col items-center justify-center gap-4 p-4 py-24 lg:order-1">
            <BookPreview
              name={previewData.name}
              period={previewData.period}
              sub={previewData.sub}
            />
            <span className="text-info-950 flex items-center justify-center gap-2 text-center font-semibold">
              <EyeIcon strokeWidth={3} size={20} /> Vorschau
            </span>

            {/* Add validation feedback */}
            {!isFormValid && (
              <div className="text-pirrot-red-400 mt-2 flex items-center gap-2 text-sm">
                <AlertCircle size={16} />
                <span>Bitte füllen Sie alle Pflichtfelder aus</span>
              </div>
            )}
          </div>

          <div className="text-info-950 relative order-1 col-span-1 flex flex-col justify-center gap-8 lg:order-2 lg:col-span-2">
            <div className="bg-pirrot-blue-100/20 absolute z-0 size-full rounded-3xl blur-xl"></div>
            <PlannerForm
              onFormChange={setPreviewData}
              onValidationChange={setIsFormValid}
            />
          </div>
        </div>
      </div>

      <About />

      <Footer />
    </div>
  );
}
