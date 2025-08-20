'use client'
import Image from "next/image"

const templates = [
	{ src: "/assets/gen/pirgen_minimal.png", title: "Minimal" },
	{ src: "/assets/gen/pirgen_official.png", title: "Official" },
	{ src: "/assets/gen/pirgen_calendar.png", title: "Kalender" },
	{ src: "/assets/gen/pirgen_schedule.png", title: "Stundenplan" },
	{ src: "/assets/gen/pirgen_r_planner.png", title: "Rechts Planner" },
	{ src: "/assets/gen/pirgen_l_planner.png", title: "Links Planner" },
]

export default function TemplateGallery() {
	return (
		<section className="w-full max-w-screen-xl px-4 py-12">
			<h2 className="text-3xl font-bold font-cairo text-info-950 mb-6">Vorlagen & Beispiele</h2>
			<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
				{templates.map((t, i) => (
					<div key={i} className="bg-white/60 border border-pirrot-blue-200/30 rounded p-3">
						<div className="relative w-full aspect-[4/3] overflow-hidden rounded">
							<Image src={t.src} alt={t.title} fill className="object-contain" />
						</div>
						<p className="mt-2 text-center font-cairo text-info-800">{t.title}</p>
					</div>
				))}
			</div>
		</section>
	)
}