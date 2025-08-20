'use client'
import { Component, PrinterCheck, User } from "lucide-react";
import { motion } from "framer-motion"
import { fadeIn, staggerChildren } from "@/util/animation-helpers";

export default function About(){
    
    return (
        <section id="about" className="relative mx-auto flex size-full max-w-screen-xl flex-col gap-12 p-6 pb-16 pt-24 min-h-screen justify-center items-center">
            <div className="w-full max-w-3xl bg-pirrot-blue-100/40 blur-3xl absolute aspect-square rounded-full z-[0]" />
            <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                className="flex flex-col gap-8 z-[1]"
            >
                <motion.h2
                    variants={fadeIn}
                    className="text-pirrot-red-400 font-cairo font-bold w-full text-start text-5xl lg:text-center"
                >
                    Generator Funktionen
                </motion.h2>
                <motion.p
                    variants={fadeIn}
                    className="mx-auto size-full max-w-2xl text-xl font-baloo text-info-800 lg:text-center"
                >
                    Lernen Sie, wie unser Generator Ihnen hilft, einen maßgeschneiderten Hausaufgabenplaner zu erstellen, und entdecken Sie die Funktionen, die den Prozess vereinfachen. Erfahren Sie, wie unser effektives Online-Tool für Sie arbeitet.
                </motion.p>
            </motion.div>
            <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={staggerChildren}
                className="flex flex-col gap-8 pt-8"
            >
                <motion.div variants={staggerChildren} className="grid gap-8 md:grid-cols-3">
                    {[
                        {
                            icon: <Component />,
                            title: "Modular",
                            description: "Einfach und flexible Gestaltung duch den modular strukturierbaren Aufbau unserer Hausaufgaben Planer.",
                        },
                        {
                            icon: <User />,
                            title: "Eigene Dokumente",
                            description: "Ihr eigener Stil ganz einfach integriert. Platzieren Sie interne Dokumente genau da wo sie hingehören.",
                        },
                        {
                            icon: <PrinterCheck />,
                            title: "Schneller Druck",
                            description: "Nach dem absenden, beginnen wir direkt mit der Produktion Ihrer Planer um eine zeitnahe Lieferung zu garantieren.",
                        },
                    ].map((pillar, index) => (
                        <motion.div key={index} variants={fadeIn}>
                            <div className="h-full rounded-xl border border-pirrot-blue-200/50 bg-white/60 backdrop-blur-sm text-info-900 hover:bg-white/80 transition-colors duration-300 shadow-sm">
                                <div className="p-6">
                                    <div className="mb-4 flex items-center gap-2">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pirrot-red-400 text-white">
                                            {pillar.icon}
                                        </div>
                                        <h4 className="text-xl font-bold font-cairo text-info-950">{pillar.title}</h4>
                                    </div>
                                    <p className="text-lg font-baloo text-info-700">{pillar.description}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </motion.div>
        </section>
    )
}