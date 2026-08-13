#import "@preview/hei-synd-thesis:0.4.0": *

//-------------------------------------
// Document options
//
#let option = (
  type : sys.inputs.at("type", default:"final"),    // [draft|final]
  lang : sys.inputs.at("lang", default:"en"),       // [en|fr|de]
  template    : "thesis",   // [thesis/midterm]
)
//-------------------------------------
// Optional generate titlepage image
//
#import "@preview/fractusist:0.3.2":*
#let project-logo = image("/resources/img/project-logo.jpeg", width: 5cm)

//-------------------------------------
// Metadata of the document
//
#let doc= (
  title    : "Electric Vehicle Charging Station Management System",
  //subtitle : "idk",
  author: (
    (
      gender      : "masculin",  // ["masculin"|"feminin"|"inclusive"]
      name        : "Basile Gasser",
      email       : "basile.gasser@students.hevs.ch",
      degree      : "Bachelor",
      affiliation : "HEI-Vs",
      place       : "Sion",
      url         : "https://synd.hevs.io",
      signature   : image("/resources/img/signature.svg", width:1.3cm),
    ),
  ),
  keywords : ("HEI-Vs", "Systems Engineering", "Infotronics", "Thesis", "Template"),
  version  : "v0.1.0",
)

// Thesis Data Page
#let thesis-data-page = [
  #image("/resources/thesis-data.pdf", page: 1, width: 100%)
  #image("/resources/thesis-data.pdf", page: 2, width: 100%)
]
// Summary Page
#let summary-page = (
  logo: project-logo,
  //one sentence with max. 240 characters, with spaces.
  objective: [
    Design and development of a Proof of Concept (PoC) for a centralised monitoring platform (CSMS CitrineOS) and a dashboard (React) for the fleet of charging stations on the HES-SO Valais-Wallis campus. The aim is to provide real-time monitoring, manage users and RFID badges, and implement a dynamic power allocation algorithm (Smart Charging) using Go-based microservices.

    Design a PoC for a centralized supervision platform (CitrineOS) integrating a React dashboard and Go microservices for real-time tracking, RFID access management, and intelligent power allocation (Smart Charging).
  ],
  //summary max. 1200 characters, with spaces.
  content: [
   Methods: The CitrineOS CSMS was deployed on an internal server and integrated with a React user interface for centralized management. To ensure security and efficiency, a Go-based microservices architecture was developed to automate RFID badge management, detect inactive charging sessions, and execute the dynamic power allocation algorithm (Smart Charging).

   Experiments: To rigorously validate the system under large-scale conditions and compensate for the obsolescence of the campus infrastructure, a heterogeneous testing environment was established. This setup combined EVerest simulators (OCPP 2.1) and a Zaptec Go test station (OCPP 1.6), operating in conjunction with the compatible physical stations in the parking lot.

   Results: The Proof of Concept demonstrates the feasibility of an open, sustainable, and vendor-independent centralized supervision system. The conducted tests validated the reliability of Smart Charging, secure user authentication, and real-time monitoring, establishing a robust technical foundation for the future modernization of the entire campus charging network.
  ],
  address: [HES-SO Valais Wallis • rue de l'Industrie 23 • 1950 Sion \ +41 58 606 85 11 • #link("mailto"+"info@hevs.ch")[info\@hevs.ch] • #link("www.hevs.ch")[www.hevs.ch]]
)

// Display Options for additional pages
#let display = (
  report-info: true,  // [true|false] display report info with declaration of honor
  thesis-data: true,  // [true|false] display thesis data page
  summary: true,      // [true|false] display summary page
)

#let professor = (
  (
    affiliation: "HEI-Vs",
    name: "Prof. Christopher Métrailler",
    email: "christopher.metrailler@hevs.ch",
  ),
)
#let expert = (
  (
    affiliation: "HES-SO Valais Wallis",
    name: "Samy Francelet",
    email: "sfrancelet@digital-logic.ch",
  ),
)
#let school= (
  name: none,
  orientation: none,
  specialisation: none,
)
#if option.lang == "de" {
  school.name = "Hochschule für Ingenieurwissenschaften Wallis, HES-SO"
  school.shortname = "HEI-Vs"
  school.orientation = "Systemtechnik"
  school.specialisation = "Infotronics"
} else if option.lang == "fr" {
  school.name = "Haute École d'Ingénierie du Valais, HES-SO"
  school.shortname = "HEI-Vs"
  school.orientation = "Systèmes industriels"
  school.specialisation = "Infotronics"
} else {
  school.name = "University of Applied Sciences Western Switzerland, HES-SO Valais Wallis"
  school.shortname = "HEI-Vs"
  school.orientation = "Systems Engineering"
  school.specialisation = "Infotronics"
}

#let date = (
  submission: datetime(year: 2026, month: 8, day: 14),
  mid-term-submission: datetime(year: 2026, month: 5, day: 1),
  today: datetime.today(),
)

#let logos = (
  main: project-logo,
  topleft: if option.lang == "fr" or option.lang == "de" {
    image("/resources/img/logos/hei-defr.svg", width: 6cm)
  } else {
    image("/resources/img/logos/hei-en.svg", width: 6cm)
  },
  topright: image("/resources/img/logos/hesso-logo.svg", width: 4cm),
  bottomleft: image("/resources/img/logos/hevs-pictogram.svg", width: 4cm),
  bottomright: image("/resources/img/logos/swiss_universities-valais-excellence-logo.svg", width: 5cm),
  )
)

//-------------------------------------
// Settings
//
#let tableof = (
  toc: true,
  tof: false,
  tot: false,
  tol: false,
  toe: false,
  maxdepth: 3,
)

#let gloss    = true
#let appendix = true
#let bib = (
  display : true,
  path  : "/tail/bibliography.bib",
  style : "ieee", //"apa", "chicago-author-date", "chicago-notes", "mla"
)

#let fonts = (
  text: "Libertinus Serif",
  mono: "DejaVu Sans Mono",
  math: "New Computer Modern Math",
)
