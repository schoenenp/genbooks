'use client'

import { EyeIcon, AlertCircle } from "lucide-react"
import { useState } from "react"
import BookPreview from "./book-preview"
import About from "./about"
import PlannerForm from "./planner-form"
import HowItWorks from "./how-it-works"
// import TemplateGallery from "./template-gallery"
import Footer from "./footer"
// import FAQ from "./faq"


const currentDate = new Date()
const nextYearDate = new Date(currentDate)
nextYearDate.setFullYear(currentDate.getFullYear() + 1)

export default function StartConfig(){
    const [previewData, setPreviewData] = useState({
        name: "Hausaufgaben",
        sub: "Meine Schule",
        period: {
            start: currentDate.toISOString().slice(0, 16),
            end: nextYearDate.toISOString().slice(0, 16)
        }
    })

    const [isFormValid, setIsFormValid] = useState(false)

    return (
        <div className="w-full flex flex-col gap-12 justify-center items-center">
            <h1 className="text-5xl lg:text-7xl uppercase font-cairo font-black text-pirrot-red-400 flex gap-4 p-4 items-center justify-center">
                Schulplaner Generator
            </h1>
            <p className="text-xl font-baloo max-w-xl lg:text-center p-4">
                Gestalten Sie individuelle Schulplaner mit Hausaufgabenübersicht, Stundenplan, Kalender und allen wichtigen Funktionen für den Schulalltag.
            </p>
            <HowItWorks />
            <div className="bg-pirrot-blue-50 min-h-[640px] border-red p-2 lg:p-4 w-full flex justify-center items-center py-12">
                <div className="w-full max-w-screen-xl grid grid-cols-1 lg:grid-cols-3 justify-center items-center gap-8 py-12">
                    <div className="col-span-1 order-2 lg:order-1 bg-pirrot-blue-50 p-4 py-24 w-full text-pirrot-blue-50 flex justify-center items-center flex-col gap-4">
                        <BookPreview 
                            name={previewData.name} 
                            period={previewData.period} 
                            sub={previewData.sub} 
                        />
                        <span className="text-info-950 flex gap-2 justify-center items-center text-center font-semibold">
                            <EyeIcon strokeWidth={3} size={20} /> Vorschau
                        </span>
                        
                        {/* Add validation feedback */}
                        {!isFormValid && (
                            <div className="flex items-center gap-2 text-pirrot-red-400 text-sm mt-2">
                                <AlertCircle size={16} />
                                <span>Bitte füllen Sie alle Pflichtfelder aus</span>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex flex-col order-1 lg:order-2 col-span-1 lg:col-span-2 gap-8 justify-center text-info-950 relative">
                        <div className="blur-xl bg-pirrot-blue-100/20 absolute rounded-3xl size-full z-0"></div>
                        <PlannerForm 
                            onFormChange={setPreviewData} 
                            onValidationChange={setIsFormValid}
                        />
                    </div>
                </div>
            </div>
            
            <About />
{/*     
            <TemplateGallery /> */}
            <Footer />
        </div>
    )
}