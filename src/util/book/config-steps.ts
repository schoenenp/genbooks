
export const configSteps = [{
    id: "COVER",
    title:"Umschlag | Deck- & Rückblatt",
    img: "img",
    desc:"Wählen Sie ein Cover Modul aus oder laden Sie ihr eigenes Buchcover hoch um mit dem nächsten Schritt fortzufahren.",
    modules:{
        min:1,
        max:1,
        include:["umschlag"],
        exclude:[]
    },
    tooltips: [ "anschnitt", "auflösung", "farbprofil", "bildkompression" ],
    component: "cover"
},
{
    id:"PRE",
    title: "Vorderer Teil | Infos & Planung I",
    img:"official",
    desc: "Der vordere Teil eines Planers eignet sich wunderbar dafür einige Infos unterzubringen oder Planungshilfen wie zB. Hausordnung, Stundenplan, Kontakte",
    modules:{
        min:0,
        max:-1,
        include:[],
        exclude:["custom","bindung", "umschlag","wochenplaner"]
    },
    tooltips:["anschnitt", "auflösung", "dateiformat", "farbmodus"],
    component: "info"
},
{
    id:"PLANNER",
    title: "Hauptteil | Wochenplaner",
    img:"r_planner",
    desc: "Im Fokus steht natürlich im Hauptteil der Wochenplaner. Hier können Sie ein Layout auswählen oder einen eigenen Mittelteil hochladen der von Anfang bis Ende des Schuljahres geht.",
    modules:{
        min:1,
        max:1,
        include:["wochenplaner"],
        exclude:["custom","bindung",]
    },
    tooltips:["reihenfolge","farbmodus", "seitenrand", "farbprofil" ],
    component: "planner"
},
{
    id:"POST",
    title: "Hinterer Teil | Infos & Planung II",
    img:"sponsor",
    desc: "Wie bereits im vorderen Teil, ist beim hinteren noch Platz um wichtige Informationen und Tools zu verstauen. Sponsoren sehen sich hier auch gerne Großflächig platziert.",
    modules:{
        min:0,
        max:-1,
        include:[],
        exclude:["custom","bindung", "umschlag","wochenplaner"]
    },
    tooltips:["dateiformat", "anschnitt", "auflösung", "farbmodus"],
    component:"info"
},
{
    id:"OVERVIEW",
    title: "Zusammenfassung & Druck",
    img:"text",
    desc: "Fast geschafft! Überprüfen Sie noch einmal zur Sicherheit das erstellte Dokument und die unten aufgelisteten Daten auf Fehlerlosigkeit. Wenn alles soweit passt, sind sie schon soweit Fertig! Also los — Überprüfen, abschicken und bestellen! Wir warten auf Sie.",
    modules:{
        min:0,
        max:0,
        include:["bindung"],
        exclude:[]
    },
    tooltips:["anschnitt", "auflösung", "farbprofil", "schriftarten", "bildkompression" ],
    component:"overview"
},
]
