#import "/metadata.typ": *

#let entry-list = (
  (
    key: "hei",
    short: "HEI",
    long: "Haute École d'Ingénierie",
    group: "University"
  ),
  (
    key: "synd",
    short: "SYND",
    long: "Systems Engineering",
    group: "University"
  ),
  (
    key: "it",
    short: "IT",
    long: "Infotronics",
    group: "University"
  ),
  (
    key: "ocpp",
    short: "OCPP",
    long: "Open Charge Point Protocol",
    description: "Standard communication protocol between charging stations and a centralized management system.",
    group: "Protocols"
  ),
  (
    key: "csms",
    short: "CSMS",
    long: "Charging Station Management System",
    description: "Centralized software system for supervising, managing, and controlling a network of charging stations.",
    group: "Systems"
  ),
  (
    key: "poc",
    short: "PoC",
    long: "Proof of Concept",
    description: "Proof of Concept. A concrete and preliminary experimental realization illustrating a certain method or idea to demonstrate its feasibility.",
    group: "General"
  ),
  (
    key: "smartcharging",
    short: "Smart Charging",
    long: "Load-Balancing / Smart Charging",
    description: "Dynamic electrical power distribution algorithm used to optimize consumption without exceeding network limits.",
    group: "Concepts"
  ),
  (
    key: "jwt",
    short: "JWT",
    long: "JSON Web Token",
    description: "Open standard for the secure and autonomous exchange of information as a JSON object.",
    group: "Security"
  ),
  (
    key: "rfid",
    short: "RFID / NFC",
    long: "Radio Frequency Identification / Near Field Communication",
    description: "Short-range wireless communication technologies used in this project for the physical authentication of users at charging stations.",
    group: "Hardware"
  ),
  (
    key: "webhook",
    short: "Webhook",
    long: "Event Trigger / Webhook",
    description: "Method for real-time data transmission between applications via event-driven HTTP requests.",
    group: "Concepts"
  ),
  (
    key: "graphql",
    short: "GraphQL",
    long: "GraphQL",
    description: "Query language for APIs that allows the client to request exactly the data it needs, utilized here via the Hasura engine.",
    group: "Protocols"
  ),
  (
    key: "goroutine",
    short: "Goroutine",
    long: "Goroutine",
    description: "Concurrent function in the Go programming language with a very low memory and CPU footprint.",
    group: "Programming"
  )
)

#let make_glossary(
  gloss:true,
  title: i18n("gloss-title", lang: option.lang),
) = {[
  #if gloss == true {[
    #pagebreak()
    #set heading(numbering: none)
    = #title <sec:glossary>
    #print-glossary(
      entry-list,
      // show all term even if they are not referenced, default to true
      show-all: true,
      // disable the back ref at the end of the descriptions
      disable-back-references: false,
    )
  ]} else{[
    #set text(size: 0pt)
    #title <sec:glossary>
    #print-glossary(
      entry-list,
      // show all term even if they are not referenced, default to true
      show-all: false,
      // disable the back ref at the end of the descriptions
      disable-back-references: false,
    )
  ]}
]}