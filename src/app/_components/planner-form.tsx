'use client'
import { ArrowRight, FolderUp, HelpCircle } from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { api } from "@/trpc/react"
import { Regions } from "@/util/book/regions"

const currentDate = new Date()
const nextYearDate = new Date(currentDate)
nextYearDate.setFullYear(currentDate.getFullYear() + 1)

interface PlannerFormProps {
    onFormChange?: (data: {
        name: string
        sub: string
        period: { start: string; end: string }
    }) => void
    onValidationChange?: (isValid: boolean) => void
}

export default function PlannerForm({ onFormChange, onValidationChange }: PlannerFormProps) {
    const router = useRouter()
    const [name, setName] = useState<string>("Hausaufgaben")
    const [sub, setSub] = useState<string>("Meine Schule")
    const [region, setRegion] = useState<string>("DE-SL")

    const makeConfig = api.book.init.useMutation({
        onSuccess: async (data) => {
            router.push(`/config?bookId=${data.id}`)
        }
    })

    const [period, setPeriod] = useState({
        start: currentDate.toISOString().slice(0, 16),
        end: nextYearDate.toISOString().slice(0, 16)
    })

    // Notify parent component of form changes for preview
    useEffect(() => {
        onFormChange?.({
            name,
            sub,
            period
        })
    }, [name, sub, period, onFormChange])
    
    // Add validation logic
    useEffect(() => {
        const isFutureEnd = new Date(period.start) < new Date(period.end)
        let isValid = name.trim() !== '' && 
                       sub.trim() !== '' && 
                       period.start && 
                       period.end &&
                       isFutureEnd

        if(typeof isValid === "string"){
            isValid = false
        }
        
        onValidationChange?.(isValid)
    }, [name, sub, period, onValidationChange])

    async function handleNewConfig(event: React.MouseEvent) {
        event.preventDefault()
        event.stopPropagation()
        await makeConfig.mutateAsync({
            name,
            sub,
            region,
            planStart: period.start,
            planEnd: period.end
        })
    }

    return (
        <form className="flex flex-col gap-8 text-xl justify-center items-center font-baloo z-[1] p-4 pt-5 pb-6">
            <h2 className="text-pirrot-red-400 font-bold w-full text-start text-5xl">Infos zum Planer</h2>
            <p className="w-full pl-4 text-xl text-start">
                Füllen Sie mindestens die erforderlichen Felder aus. Die angegeben Daten können immer noch im Nachgang geändert werden. Durch einen einfachen Klick auf den Weiter Button leiten wir Sie Schritt-für-Schritt und problemlos durch den gesamten Prozess.
            </p>
            
            <div className="w-full max-w-screen-xl mb-8">
                <h3 className="text-2xl font-bold font-cairo text-info-950 mb-4">Schnellstart Vorlagen</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { name: "Grundschule", sub: "1. Klasse", period: { start: "2024-08-01", end: "2025-07-31" } },
                        { name: "Gymnasium", sub: "5. Klasse", period: { start: "2024-08-01", end: "2025-07-31" } },
                        { name: "Hausaufgaben", sub: "Meine Schule", period: { start: "2024-08-01", end: "2025-07-31" } }
                    ].map((template, index) => (
                        <button
                            type="button"
                            key={index}
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setName(template.name)
                                setSub(template.sub)
                                setPeriod(template.period)
                            }}
                            className="p-4 border border-pirrot-blue-200 rounded-lg hover:bg-pirrot-blue-100/50 transition-colors"
                        >
                            <h4 className="font-bold font-cairo">{template.name}</h4>
                            <p className="text-sm text-info-600">{template.sub}</p>
                        </button>
                    ))}
                </div>
            </div>

            
            <div className="w-full flex flex-col gap-2 text-info-950">
                <div className="flex items-center gap-2">
                    <label className="font-bold font-cairo" htmlFor="title">Titel</label>
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
            
            <div className="flex flex-col gap-8 w-full md:flex-row">
                <div className="w-full flex-1 flex flex-col gap-2 text-info-950">
                    <label className="font-bold font-cairo" htmlFor="sub">Schulart / Untertitel</label>
                    <input 
                        id="sub"
                        className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2"
                        list="schoolsList"
                        onChange={(e) => setSub(e.target.value)}
                        value={sub} 
                    />
                    <datalist id="schoolsList">
                        {["Grundschule", "Erweiterte Realschule", "Gesamtschule", "Gymnasium"].map((item, index) => (
                            <option key={index} value={item} />
                        ))}
                    </datalist>
                </div>

                <div className="w-full flex-1">
                    <label className="font-bold font-cairo" htmlFor="region">Bundesland</label>
                    <select
                        id="region"
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2"
                    >
                        {Regions.sort((a, b) => a.land.localeCompare(b.land)).map((r, i) => (
                            <option key={i} value={r.code}>{r.land}</option>
                        ))}
                    </select>
                </div>
            </div>
            
            <div className="w-full flex flex-col gap-8 lg:flex-row justify-between text-info-950">
                <div className="flex flex-1 flex-col gap-2">
                    <label className="font-bold font-cairo" htmlFor="start">Planer Start</label>
                    <input 
                        id="start"
                        type="date" 
                        value={period.start.split('T')[0]}
                        onChange={(e) => setPeriod({ ...period, start: e.target.value })}
                        className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2" 
                    />
                </div>
                
                <div className="flex flex-1 flex-col gap-2">
                    <label className="font-bold font-cairo" htmlFor="end">Planer Ende</label>
                    <input 
                        id="end"
                        type="date" 
                        value={period.end.split('T')[0]}
                        onChange={(e) => setPeriod({ ...period, end: e.target.value })}
                        className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2" 
                    />
                </div>
            </div>
            
            <div className="w-full flex gap-4">
                <button 
                    type="button"
                    onClick={() => {
                        // Save to localStorage or send to backend
                        localStorage.setItem('planner-draft', JSON.stringify({ name, sub, region, period }))
                    }}
                    className="text-info-600 hover:text-info-800 text-sm underline"
                >
                    Entwurf speichern
                </button>
                <button 
                    type="button"
                    onClick={() => {
                        const draft = localStorage.getItem('planner-draft')
                        if (draft) {
                            const data = JSON.parse(draft) as { 
                                name: string;
                                sub: string;
                                region: string;
                                period: {
                                    start:string
                                    end:string
                                };
                            }
                            setName(data.name)
                            setSub(data.sub)
                            setRegion(data.region)
                            setPeriod(data.period)
                        }
                    }}
                    className="text-info-600 hover:text-info-800 text-sm underline"
                >
                    Entwurf laden
                </button>
            </div>
            
            <div className="w-full flex gap-8">
                <Link 
                    href="dashboard?view=planer" 
                    className="hover:bg-pirrot-blue-100/50 relative flex-1 flex gap-2 cursor-pointer rounded border px-4 py-2 transition-colors duration-500 items-center justify-center hover:animate-pulse bg-pirrot-blue-50 text-info-950 border-white/50"
                > 
                    Planer Laden <FolderUp />
                </Link>
                <button 
                    onClick={handleNewConfig}
                    disabled={makeConfig.isPending}
                    className="hover:bg-pirrot-blue-100/50 relative flex-1 flex items-center justify-center gap-2 cursor-pointer rounded border px-4 py-2 transition-colors duration-500 hover:animate-pulse bg-pirrot-blue-50 text-info-950 border-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {makeConfig.isPending ? 'Wird erstellt...' : 'Weiter'} <ArrowRight />
                </button>
            </div>
        </form>
    )
}