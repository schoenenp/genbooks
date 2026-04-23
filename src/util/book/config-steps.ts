import type { ConfigStepId } from "@/util/book/configurator";

export const configSteps: Array<{
  id: ConfigStepId;
  title: string;
  desc: string;
}> = [
  {
    id: "COVER",
    title: "Umschlag",
    desc: "Wählen Sie zuerst den Umschlag Ihres Planers aus.",
  },
  {
    id: "PRE",
    title: "Vorderer Teil",
    desc: "Ergänzen Sie optionale Module vor dem Wochenplaner.",
  },
  {
    id: "PLANNER",
    title: "Wochenplaner",
    desc: "Wählen Sie den verpflichtenden Hauptteil Ihres Planers.",
  },
  {
    id: "POST",
    title: "Hinterer Teil",
    desc: "Ergänzen Sie optionale Module nach dem Wochenplaner.",
  },
  {
    id: "BINDING",
    title: "Bindung",
    desc: "Wählen Sie die passende Bindung für Ihre Seitenzahl.",
  },
  {
    id: "CHECKOUT",
    title: "Checkout",
    desc: "Prüfen Sie Ihre Konfiguration und schließen Sie die Bestellung ab.",
  },
];
