import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  MailCheck,
  MonitorCheck,
  PackageCheck,
  Send,
  Settings2,
  ShieldCheck,
  Truck,
} from "lucide-react";
import Footer from "@/app/_components/footer";
import Navigation from "@/app/_components/navigation";

const flowSteps = [
  {
    icon: Handshake,
    title: "1. Partner-Onboarding im Dashboard",
    text: "Partner-Programm-Abo aktivieren, Stripe Connect verbinden und eine eigene Vorlage als Kampagne bereitstellen.",
  },
  {
    icon: MailCheck,
    title: "2. Schule verifiziert den Zugang",
    text: "Schule gibt Promo-Code und E-Mail ein und bestätigt den Verifizierungslink. So wird die Vorlage eindeutig und sicher zugeordnet.",
  },
  {
    icon: Settings2,
    title: "3. Konfiguration auf Partner-Vorlage",
    text: "Die Konfiguration startet direkt auf der bereitgestellten Partner-Vorlage. Zusätzliche Module können bei Bedarf ergänzt werden.",
  },
  {
    icon: ClipboardCheck,
    title: "4. Bestellung geht in die Partner-Prüfung",
    text: "Nach dem Absenden erscheint die Bestellung zuerst im Partner-Bereich zur fachlichen Prüfung.",
  },
  {
    icon: CheckCircle2,
    title: "5. Partner bestätigt oder lehnt ab",
    text: "Nur bestätigte Bestellungen werden weitergeführt. Ablehnungen werden mit Begründung dokumentiert.",
  },
  {
    icon: Truck,
    title: "6. Freigabe für Produktion und Erfüllung",
    text: "Die Produktion startet erst nach aktiver Freigabe durch den Partner.",
  },
] as const;

const partnerBenefits = [
  "Volle Steuerung: Keine Produktionsauslösung ohne Partner-Freigabe",
  "Revisionssicher: Alle Statuswechsel werden nachvollziehbar protokolliert",
  "Skalierbar: Viele Schulbestellungen können strukturiert geprüft werden",
  "Vertriebsstark: Schulen erhalten einen klaren, geführten Bestellprozess",
] as const;

const faqItems = [
  {
    q: "Wer bekommt welche Rechnung?",
    a: "Die Schule erhält die Rechnung im Partner-Kontext. Produktion und Fulfillment laufen über die Plattform. Partner-Abrechnungen zur Plattform können gesammelt erfolgen.",
  },
  {
    q: "Kann die Schule später weiterkonfigurieren?",
    a: "Ja. Partner-Vorlagen können im Planer-Bereich fortgesetzt werden, solange die Kampagne aktiv ist und noch keine Bestellung eingereicht wurde.",
  },
  {
    q: "Wann endet die Partner-Markierung?",
    a: "Wenn die Kampagne abläuft oder sobald die Bestellung eingereicht wurde.",
  },
  {
    q: "Für welche Länder ist Stripe Connect aktuell aktiv?",
    a: "Aktuell für Österreich (AT) und Deutschland (DE).",
  },
] as const;

const uiGuideItems = [
  {
    icon: LayoutDashboard,
    area: "Profil",
    title: "Partner-Bestellungen prüfen",
    description:
      "Hier sieht der Partner neue Bestellungen, öffnet Details und bestätigt oder lehnt ab.",
  },
  {
    icon: Settings2,
    area: "Planer",
    title: "Partner-Vorlagen fortsetzen",
    description:
      "Schulen können konfigurierte Partner-Vorlagen später wieder öffnen und weiter bearbeiten.",
  },
  {
    icon: Send,
    area: "Freigabe",
    title: "Produktion aktiv freigeben",
    description:
      "Nach Bestätigung kann der Partner den Auftrag explizit an die Produktion senden.",
  },
] as const;

function SectionHeader(props: { title: string; subtitle: string }) {
  return (
    <div className="mb-5 flex flex-col gap-2">
      <h2 className="text-3xl font-black uppercase text-info-950 sm:text-4xl">
        {props.title}
      </h2>
      <p className="max-w-3xl text-info-700">{props.subtitle}</p>
      <div className="h-1 w-24 rounded-full bg-gradient-to-r from-pirrot-blue-500 to-pirrot-red-300" />
    </div>
  );
}

export default async function PartnerInfoPage({
  searchParams,
}: {
  searchParams?: Promise<{ demo?: string }>;
}) {
  const { demo } = (await searchParams) ?? {};
  const isDemoView = demo === "1";

  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden text-info-900">
      <div className="subtle-grid pointer-events-none absolute inset-0 opacity-30" />
      <Navigation />

      <section className="section-shell relative z-10 mt-8 pb-4">
        <div className="content-card grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.35fr_1fr] lg:items-center">
          <div className="flex flex-col gap-4">
            <p className="text-xs font-black uppercase tracking-[0.1em] text-pirrot-blue-700">
              Partner-Programm
            </p>
            <h1 className="text-4xl font-black uppercase text-info-950 sm:text-5xl">
              Das Partner-Programm klar erklärt
            </h1>
            <p className="max-w-2xl text-base text-info-700 sm:text-lg">
              Sie stellen Vorlagen bereit, Schulen konfigurieren darauf, und
              Sie entscheiden im Dashboard, welche Bestellungen in die
              Produktion überführt werden.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard?view=partner"
                className="btn-solid inline-flex items-center gap-2 px-4 py-2.5"
              >
                Partner-Bereich öffnen
                <ArrowRight size={16} />
              </Link>
              <Link href="/template" className="btn-soft px-4 py-2.5">
                Template-Entry ansehen
              </Link>
              <Link
                href={isDemoView ? "/partner-info" : "/partner-info?demo=1"}
                className="btn-soft inline-flex items-center gap-2 px-4 py-2.5"
              >
                <MonitorCheck size={16} />
                {isDemoView ? "Demo-View ausblenden" : "Demo-View anzeigen"}
              </Link>
            </div>
          </div>

          <aside className="content-card border border-pirrot-blue-200/50 bg-pirrot-blue-50/65 p-4">
            <p className="text-sm font-bold uppercase tracking-[0.08em]">
              Zielgruppe
            </p>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-info-800">
              <li className="field-shell flex items-center gap-2 px-3 py-2">
                <Building2 size={16} /> Partner mit eigenem Schulvertrieb
              </li>
              <li className="field-shell flex items-center gap-2 px-3 py-2">
                <GraduationCap size={16} /> Schulen, die auf Vorlagen bestellen
              </li>
              <li className="field-shell flex items-center gap-2 px-3 py-2">
                <ShieldCheck size={16} /> Organisationen mit klaren Freigabeprozessen
              </li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="section-shell relative z-10 py-6">
        <SectionHeader
          title="UI-Leitfaden"
          subtitle="Wo Partner welche Aktion im Produkt ausführen."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {uiGuideItems.map((item) => (
            <article key={item.title} className="content-card flex flex-col gap-3 p-4">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-pirrot-blue-100 px-3 py-1 text-xs font-bold uppercase text-pirrot-blue-800">
                <item.icon size={14} />
                {item.area}
              </div>
              <h3 className="text-base font-black text-info-950">{item.title}</h3>
              <p className="text-sm text-info-700">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      {isDemoView ? (
        <section className="section-shell relative z-10 py-6">
          <SectionHeader
            title="Demo-View"
            subtitle="Visuelle Kurzansicht für Präsentationen mit Partnern."
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <article className="content-card p-5">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-info-600">
                Partner-Profil
              </p>
              <h3 className="mt-2 text-lg font-black text-info-950">
                Eingehende Partner-Bestellungen
              </h3>
              <div className="mt-4 space-y-2 text-sm">
                <div className="field-shell flex items-center justify-between px-3 py-2">
                  <span>Schule Mustergymnasium</span>
                  <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                    Eingereicht
                  </span>
                </div>
                <div className="field-shell flex items-center justify-between px-3 py-2">
                  <span>Schule Campus Nord</span>
                  <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                    Bestätigt
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded bg-pirrot-blue-100 px-2 py-1 font-semibold text-pirrot-blue-800">
                  Partnerschaft bestätigen
                </span>
                <span className="rounded bg-pirrot-blue-100 px-2 py-1 font-semibold text-pirrot-blue-800">
                  Ablehnen
                </span>
                <span className="rounded bg-pirrot-blue-100 px-2 py-1 font-semibold text-pirrot-blue-800">
                  An Produktion senden
                </span>
              </div>
            </article>

            <article className="content-card p-5">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-info-600">
                Auftragsfluss
              </p>
              <h3 className="mt-2 text-lg font-black text-info-950">
                Status bis zur Erfüllung
              </h3>
              <ol className="mt-4 space-y-2 text-sm">
                <li className="field-shell flex items-center gap-2 px-3 py-2">
                  <CheckCircle2 size={15} className="text-pirrot-green-600" />
                  Von Schule eingereicht
                </li>
                <li className="field-shell flex items-center gap-2 px-3 py-2">
                  <PackageCheck size={15} className="text-pirrot-blue-700" />
                  Vom Partner bestätigt
                </li>
                <li className="field-shell flex items-center gap-2 px-3 py-2">
                  <Truck size={15} className="text-pirrot-blue-700" />
                  Für Produktion freigegeben
                </li>
              </ol>
              <p className="mt-4 text-sm text-info-700">
                Diese Reihenfolge zeigt Partnern klar, dass Produktion erst
                nach expliziter Freigabe erfolgt.
              </p>
            </article>
          </div>
        </section>
      ) : null}

      <section className="section-shell relative z-10 py-6">
        <SectionHeader
          title="Ablauf in 6 Schritten"
          subtitle="Der durchgängige Prozess vom Partner-Link bis zur Produktionsfreigabe."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {flowSteps.map((step) => (
            <article key={step.title} className="content-card flex gap-4 p-4 sm:p-5">
              <div className="mt-1 rounded-xl bg-pirrot-blue-100 p-2 text-pirrot-blue-700">
                <step.icon size={18} />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-black text-info-950">{step.title}</h3>
                <p className="text-sm text-info-700">{step.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-shell relative z-10 py-6">
        <SectionHeader
          title="Wer zahlt was?"
          subtitle="Kompakt und verständlich für Gespräche mit Partnern und Schulen."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="content-card p-5">
            <h3 className="text-lg font-black text-info-950">Schule</h3>
            <p className="mt-2 text-sm text-info-700">
              Konfiguriert den Planer auf Basis der Partner-Vorlage in einem
              klar geführten Ablauf.
            </p>
          </article>
          <article className="content-card p-5">
            <h3 className="text-lg font-black text-info-950">Partner</h3>
            <p className="mt-2 text-sm text-info-700">
              Prüft eingehende Bestellungen, bestätigt oder lehnt ab und gibt
              nur freigegebene Aufträge für Produktion frei.
            </p>
          </article>
          <article className="content-card p-5">
            <h3 className="text-lg font-black text-info-950">Plattform</h3>
            <p className="mt-2 text-sm text-info-700">
              Übernimmt Produktion, Fulfillment und technische Abwicklung.
              Statusübergänge und Audit-Daten bleiben vollständig nachvollziehbar.
            </p>
          </article>
          <article className="content-card p-5">
            <h3 className="text-lg font-black text-info-950">Rechnungskontext</h3>
            <p className="mt-2 text-sm text-info-700">
              Der Schulauftrag wird im Partner-Kontext geführt. Damit ist der
              Außenauftritt konsistent und die Verantwortlichkeit klar geregelt.
            </p>
          </article>
        </div>
      </section>

      <section className="section-shell relative z-10 py-6">
        <SectionHeader
          title="Vorteile für Partner"
          subtitle="Der konkrete Mehrwert im täglichen Betrieb."
        />
        <div className="content-card p-5">
          <ul className="grid gap-3 sm:grid-cols-2">
            {partnerBenefits.map((item) => (
              <li key={item} className="field-shell flex items-start gap-2 px-3 py-2 text-sm">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-pirrot-green-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-shell relative z-10 py-6">
        <SectionHeader
          title="Häufige Fragen"
          subtitle="Die wichtigsten Punkte für Onboarding und Vertriebsgespräche."
        />
        <div className="grid gap-3">
          {faqItems.map((item) => (
            <article key={item.q} className="content-card p-4">
              <h3 className="text-base font-black text-info-950">{item.q}</h3>
              <p className="mt-1 text-sm text-info-700">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-shell relative z-10 py-8">
        <div className="content-card flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase text-info-950">
              Nächster Schritt
            </h2>
            <p className="mt-1 text-sm text-info-700">
              Öffnen Sie den Partner-Bereich und erstellen Sie Ihre erste
              Kampagne auf Basis einer Vorlage.
            </p>
          </div>
          <Link
            href="/dashboard?view=partner"
            className="btn-solid inline-flex items-center gap-2 px-4 py-2.5"
          >
            Zum Partner-Dashboard
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
