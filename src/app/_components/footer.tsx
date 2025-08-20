'use client'
import Link from "next/link"
import { Mail, Phone, MapPin, FacebookIcon, Instagram, Linkedin } from "lucide-react"

export default function Footer() {
    const currentYear = new Date().getFullYear()
    
    return (
        <footer className="bg-gradient-to-b from-pirrot-blue-100/50 to-pirrot-blue-200/30 text-info-900 w-full border-t border-pirrot-blue-200/50">
            <div className="max-w-screen-xl mx-auto px-4 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {/* Company Info */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold font-cairo text-pirrot-red-400">
                            Digitaldruck Pirrot GmbH
                        </h3>
                        <p className="text-info-700 font-baloo text-sm leading-relaxed">
                            Ihr Partner für individuelle Schulplaner und hochwertige Druckerzeugnisse. 
                            Wir gestalten mit Ihnen zusammen maßgeschneiderte Lösungen für den Schulalltag.
                        </p>
                        <div className="flex space-x-4">
                            <a href="https://www.facebook.com/digitaldruck.pirrot" className="text-info-600 hover:text-pirrot-red-400 transition-colors">
                                <FacebookIcon size={20} />
                            </a>
                            <a href="https://www.instagram.com/digitaldruck.pirrot/" className="text-info-600 hover:text-pirrot-red-400 transition-colors">
                                <Instagram size={20} />
                            </a>
                            <a href="https://www.linkedin.com/company/digitaldruck-pirrot-gmbh/about/" className="text-info-600 hover:text-pirrot-red-400 transition-colors">
                                <Linkedin size={20} />
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="space-y-4">
                        <h4 className="font-bold font-cairo text-lg text-info-950">Schnellzugriff</h4>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link href="/" className="text-info-700 hover:text-pirrot-red-400 transition-colors font-baloo">
                                    Schulplaner Generator
                                </Link>
                            </li>
                            <li>
                                <Link href="/dashboard" className="text-info-700 hover:text-pirrot-red-400 transition-colors font-baloo">
                                    Dashboard
                                </Link>
                            </li>
                            <li>
                                <Link href="/dashboard?view=orders" className="text-info-700 hover:text-pirrot-red-400 transition-colors font-baloo">
                                    Bestellung verfolgen
                                </Link>
                            </li>
                            <li>
                                <Link href="https://www.pirrot.de" className="text-info-700 hover:text-pirrot-red-400 transition-colors font-baloo">
                                    pirrot.de
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Services */}
                    <div className="space-y-4">
                        <h4 className="font-bold font-cairo text-lg text-info-950">Unsere Services</h4>
                        <ul className="space-y-2 text-sm">
                            <li className="text-info-700 font-baloo">Individuelle Schulplaner</li>
                            <li className="text-info-700 font-baloo">Hausaufgabenhefte</li>
                            <li className="text-info-700 font-baloo">Stundenpläne</li>
                            <li className="text-info-700 font-baloo">Kalender & Terminplaner</li>
                            <li className="text-info-700 font-baloo">Bürobedarf & Druck</li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-4">
                        <h4 className="font-bold font-cairo text-lg text-info-950">Kontakt</h4>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-center space-x-3">
                                <MapPin size={16} className="text-pirrot-red-400 flex-shrink-0" />
                                <span className="text-info-700 font-baloo">
                                    Triererstraße 7<br />
                                    66125 Saarbrücken
                                </span>
                            </div>
                            <div className="flex items-center space-x-3">
                                <Phone size={16} className="text-pirrot-red-400 flex-shrink-0" />
                                <a href="tel:+49689797530" className="text-info-700 hover:text-pirrot-red-400 transition-colors font-baloo">
                                    +49 6897 97 53 0
                                </a>
                            </div>
                            <div className="flex items-center space-x-3">
                                <Mail size={16} className="text-pirrot-red-400 flex-shrink-0" />
                                <a href="mailto:info@pirrot.de" className="text-info-700 hover:text-pirrot-red-400 transition-colors font-baloo">
                                    info@pirrot.de
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="border-t border-pirrot-blue-200/50 mt-8 pt-8">
                    <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                        <div className="text-sm text-info-600 font-baloo">
                            © {currentYear} Digitaldruck Pirrot GmbH. Alle Rechte vorbehalten.
                        </div>
                        <div className="flex space-x-6 text-sm">
                            <Link href="https://secure.pirrot.de/datenschutz" className="text-info-600 hover:text-pirrot-red-400 transition-colors font-baloo">
                                Impressum
                            </Link>
                            <Link href="https://secure.pirrot.de/datenschutz" className="text-info-600 hover:text-pirrot-red-400 transition-colors font-baloo">
                                Datenschutz
                            </Link>
                            <Link href="https://secure.pirrot.de/datenschutz" className="text-info-600 hover:text-pirrot-red-400 transition-colors font-baloo">
                                AGB
                            </Link>
                            <Link href="https://secure.pirrot.de/datenschutz" className="text-info-600 hover:text-pirrot-red-400 transition-colors font-baloo">
                                Widerrufsrecht
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    )
}