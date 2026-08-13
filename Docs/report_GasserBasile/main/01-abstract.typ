#import "/metadata.typ": *
#pagebreak()
#heading(numbering:none)[#i18n("abstract-title", lang:option.lang)] <sec:abstract>

#option-style(type:option.type)[
  The abstract serves as a concise summary of your entire thesis, encapsulating key elements on a single page such as:
  - General background information
  - Objective(s)
  - Approach and method
  - Conclusions
]

*Background:* 

In 2021, HES-SO Valais-Wallis deployed a fleet of 12 charging stations on its campus. However, the obsolescence of the current infrastructure (OCPP 1.4/1.6J protocols, end of maintenance support) and the absence of a centralized Charging Station Management System (CSMS) prevent real-time monitoring, user authentication, and dynamic power management.

*Objective:* 

This Bachelor's thesis aims to design, implement, and validate a Proof of Concept (PoC) for a centralized supervision platform based on an open-source CSMS (CitrineOS). The solution integrates a React dashboard for real-time tracking and RFID access management, as well as Go microservices ensuring security, authentication, and intelligent power allocation (Smart Charging).

*Approach & Methods:* 

The CitrineOS CSMS was deployed on an internal server and coupled with a React user interface. To compensate for the obsolescence of the majority of the campus charging stations and to validate the system under large-scale conditions, EVerest simulators (OCPP 2.1) and a Zaptec Go test station (OCPP 1.6) were used in conjunction with the compatible physical stations in the parking lot. Dedicated microservices were developed to automate RFID badge management, the detection of inactive sessions, and dynamic charging optimization.

*Results & Conclusion:* 

The developed PoC demonstrates the feasibility of an open, sustainable, and vendor-independent centralized supervision system. The conducted tests validate the proper functioning of Smart Charging, secure authentication, and real-time charging monitoring, thereby laying the foundation for the future modernization of the entire campus charging infrastructure.

/*#v(2em)
#if doc.at("keywords", default:none) != none {[

  _*#i18n("keywords", lang: option.lang)*_:

  #enumerating-items(
    items: doc.keywords,
    italic: true
  )
]}*/
