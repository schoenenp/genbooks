'use client'
import { CheckCircle, Settings, Calendar } from "lucide-react"

export default function HowItWorks() {
	return (
		<section className="w-full max-w-screen-xl px-4 py-12">
			<h2 className="text-3xl font-bold font-cairo text-info-950 mb-6">So funktioniert’s</h2>
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<div className="bg-pirrot-blue-50/50 border border-pirrot-blue-200/30 rounded p-6">
					<Settings className="w-8 h-8 text-pirrot-blue-500 mb-4" />
					<h3 className="font-bold font-cairo text-lg mb-2">1. Planer konfigurieren</h3>
					<p className="text-info-700 font-baloo">Titel, Zeitraum, Bundesland und Inhalte auswählen.</p>
				</div>
				<div className="bg-pirrot-blue-50/50 border border-pirrot-blue-200/30 rounded p-6">
					<Calendar className="w-8 h-8 text-pirrot-blue-500 mb-4" />
					<h3 className="font-bold font-cairo text-lg mb-2">2. Vorschau prüfen</h3>
					<p className="text-info-700 font-baloo">Live‑Vorschau ansehen und Details anpassen.</p>
				</div>
				<div className="bg-pirrot-blue-50/50 border border-pirrot-blue-200/30 rounded p-6">
					<CheckCircle className="w-8 h-8 text-pirrot-blue-500 mb-4" />
					<h3 className="font-bold font-cairo text-lg mb-2">3. Bestellung abschließen</h3>
					<p className="text-info-700 font-baloo">Sicher bezahlen und Bestellstatus verfolgen.</p>
				</div>
			</div>
		</section>
	)
}