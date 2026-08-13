#import "/metadata.typ": *
#pagebreak()
= State of the Art and Infrastructure Audit
<sec:etat-art-audit>

== Audit of Existing Parking Infrastructure
The parking infrastructure currently consists of 12 GreenMotion chargers of 3 different types: 10 AC Private One 22 chargers @greenmotion_privateone, 1 DC XT22 charger @greenmotion_xt22, and 1 DC XT66 charger @greenmotion_xt66.

#figure(
  table(
    columns: (auto, auto, auto, auto, auto),
    align: left + top,
    fill: (x, y) => if y == 0 { rgb("f0f4f8") } else if calc.even(y) { rgb("f9f9f9") } else { none },
    stroke: 0.5pt + rgb("dddddd"),
    inset: 8pt,
    
    // En-têtes du tableau
    table.header(
      [*Charger*], 
      [*Type*], 
      [*Connectors*], 
      [*OCPP Version*], 
      [*Simultaneous charging*]
    ),

    [Private One 22],
    [AC],
    [Type 1 \\ Type 2],
    [1.4],
    [No],

    [Range XT22],
    [DC],
    [CCS2 \\ CHAdeMo],
    [1.6J],
    [No],

    [Range XT66],
    [DC],
    [CCS2 \\ CHAdeMo],
    [1.6J],
    [No],
  ),
  caption: [Comparison of charger models.],
)

All charging stations are distributed across several different power supply groups.

- *Block 1* : 400V/125A (86,6kW) -> 1 x XT66
- *Block 2* : 400V/63A (43,6kW) -> 4 x Private One 22
- *Block 3* : 400V/32A (22.2kW) -> 4 x Private One 22
- *Block 4* : 400V/63A (43,6kW) -> 2 x Private One 22 and 1 x XT22

#figure(
  image("../resources/img/electrical_schema.jpg", width: 83%),
  caption: [Electrical supply diagram of charging stations by block at the Energypolis campus.]
) <fig:electrical_schema>

As shown by the distribution of charging stations across the different power supply groups, only one block provides enough energy to fully satisfy the demand. With the current static limitation system, some chargers are throttled to only a quarter of their maximum power. This further proves the necessity of implementing a Load Balancing/Smart Charging algorithm.

Eaton's acquisition of Greenmotion in 2021 raises several other issues. Eaton's commercial strategy is centered on their global ecosystem, imposing the use of paid licensed software. Furthermore, older charging stations like the Private One see their firmware updates reduced, favoring the use of newer models. As Greenmotion was previously a Swiss-based company, support was much more flexible and accessible. With the transition under Eaton's international corporate structure, this technical support becomes significantly less adapted and accessible.

== Communication Protocols and Charging Modes (OCPP & AC/DC)
Communication between electric vehicles and charging stations is governed by several different standards and also depends on the type of charging (AC or DC) used.

*AC Charging*

AC charging communication is governed by the IEC 61851-1 standard @iec61851. This standard stipulates that communication between the vehicle and the charging station must occur via a 1kHz PWM signal emitted on the connector pin named "Control Pilot" or CP. Modulating the Duty Cycle and amplitude of this signal allows defining several charging modes and states.

*Amplitude Modulation*: The amplitude of the CP signal defines the connectivity state between the vehicle and the charging station.

- 12V : the vehicle is not connected to the charging station
- 9V : the vehicle is connected to the charging station but does not request a charge
- 6V : the vehicle is connected to the charging station and requests a charge
- 3V : the vehicle is connected to the charging station, requests a charge but requires external ventilation (very rare on modern vehicles)
- 0V : The CP pin is short-circuited, which prevents charging and indicates a fault
- -12V : The station is unavailable following a restart or a fault.

*Duty Cycle Modulation*: A very low or very high DC indicates a specific fixed state, while a DC ranging from 10% to 85% indicates a linear amperage according to the following ratio: I = DC \* 0.6.

- DC = 0%           : The station reports an error or is out of service
- DC < 3%           : The station refuses the charge
- 3% <= DC < 7%     : Switches to digital communication mode (ISO 15118 / DIN 70121)
- 7% <= DC < 10%    : Unused range reserved for future use
- 10% <= DC < 85%   : Linear amperage according to the ratio I = DC \* 0.6
- 85% <= DC < 96%   : Specific amperage according to the ratio I = (DC-64) \* 2.5
- 96% <= DC < 100%  : The station reports an error or is out of service
- DC = 100%         : Station on standby, no vehicle connected

*DC Charging*

Regarding DC charging communication protocols in Europe and America, two standards must be considered: ISO 15118 @iso15118 and DIN 70121 @din70121. These two standards define communication protocols for DC fast charging and allow bidirectional communication between the vehicle and the charging station. The DIN 70121 standard, being somewhat the ancestor of the ISO 15118 standard, is increasingly less used and tends to be replaced by the ISO 15118 standard. To enable communication between the car and the charging station, ISO 15118 relies on communication based on the OSI model. The vehicle and the station exchange data packets using standard web protocols: IPv6 and TCP.

However, in Japan and China, two other standards are used: CHAdeMO and GB/T. These standards are specific to these regions and are not compatible with the ISO 15118 and DIN 70121 standards used in Europe and America. Communication is based on a dedicated CAN bus.

*OCPP*

OCPP (Open Charge Point Protocol) is the standard open reference protocol ensuring cooperation between the charge point and the Central Charge Point Management System (CSMS). By decoupling the physical infrastructure from the management software layer, OCPP implementation prevents any risk of vendor lock-in. This technical neutrality allows integrating equipment from different manufacturers into a single network, thereby ensuring the longevity and scalability of charging station fleets in the face of future industry developments.

The OCPP protocol architecture has undergone significant structural modifications across its revisions. Version OCPP 1.4, historically based on the SOAP/XML protocol, now presents significant technical obsolescence, notably transmission rigidity, justifying the impossibility of its direct integration without an adaptation gateway. The emergence of OCPP 1.6J @oca_ocpp16 marked a decisive transition thanks to the adoption of the JSON format routed via WebSockets. This version introduced low-latency bidirectional communication as well as the first native smart charging features.

Henceforth, the OCPP 2.0.1 and 2.1 @oca_ocpp201 specifications represent the ideal technological target for modern networks. They integrate an enhanced security framework, a fully modular data model by components, and native support for advanced features such as the ISO 15118 standard (Plug & Charge, V2G) or the EVerest open-source ecosystem. The table below summarizes these evolutions and specifies the implementation status within the PoC developed in this work.

#figure(
  table(
    columns: (auto, auto, auto, auto, auto),
    align: left + top,
    fill: (x, y) => if y == 0 { rgb("f0f4f8") } else if calc.even(y) { rgb("f9f9f9") } else { none },
    stroke: 0.5pt + rgb("dddddd"),
    inset: 8pt,
    
    // En-têtes du tableau
    table.header(
      [*Version*], 
      [*Transport / Format*], 
      [*Security*], 
      [*Smart Charging Support*], 
      [*Status in the PoC*]
    ),

    // Ligne 1 : OCPP 1.4
    [OCPP 1.4],
    [HTTP \\ SOAP (XML)],
    [Low (no native encryption)],
    [Limited],
    [Not supported],

    // Ligne 2 : OCPP 1.6J
    [OCPP 1.6J],
    [WebSockets \\ JSON],
    [Medium (optional TLS)],
    [Basic profile (Smart Charging Profile)],
    [Physical DC stations],

    // Ligne 3 : OCPP 2.0.1 / 2.1
    [OCPP 2.0.1, 2.1],
    [WebSockets \\ JSON],
    [High (mandatory TLS, PKI)],
    [Advanced (ISO 15118, V2G, EVerest)],
    [EVerest Simulators],
  ),
  caption: [Comparison of OCPP versions.],
)

== Analysis of Charging Station Management Systems (CSMS)

The Charging Station Management System (CSMS) constitutes the central component of this project, around which the entire software architecture revolves. Its role is essential: maintaining real-time communication with the stations, driving transactions, and guaranteeing data storage reliability. To choose the most suitable solution, the following criteria must be considered: 
- support for OCPP versions,
- database modularity and scalability,
- the ability to integrate easily into the current ecosystem,
- the overall quality of the project's documentation.

//TO BE REPLACED BY A TABLE ????
*SteVe* @steve_csms
- OCPP Support: Made for OCPP 1.6J but completely obsolete compared to newer versions.
- DB Modularity and Extensibility: Fixed and aging architecture (Java/Spring) and rigid data schema.
- Ease of Integration: Easy to deploy on a server via Docker.
- Vitality & Documentation: Very well-documented project but no updates for some time (obsolete).
*MaEVe* @maeve_csms
- OCPP Support: Designed for OCPP 2.0.1 but partially compatible with OCPP 1.6J.
- DB Modularity and Extensibility: Adding features or modifying current structures requires rewriting part of the microservices, which could easily create conflicts with the rest of the system.
- Ease of Integration: Made for deployment on a public cloud with a Kubernetes orchestrator. Designed for larger-scale projects (thousands of stations).
- Vitality & Documentation: Very active development and regularly updated.
*CitrineOS* @citrineos_doc
- OCPP Support: Natively handles recent versions like OCPP 2.0.1/2.1 and also OCPP 1.6J via dedicated conversion modules.
- DB Modularity and Extensibility: PostgreSQL database structured in separate modules. Allows easy additions of SQL tables/columns without impacting the rest of the structure. Simplified usage via the Hasura graphical interface.
- Ease of Integration: Easy to deploy on a server via Docker.
- Vitality & Documentation: Active project in constant development. Comprehensive and reliable documentation.

For this project, CitrineOS emerged as the most suitable CSMS. It allows for simplified implementation with 1.6J stations and keeps the architecture ready for future developments. The modular structure of the PostgreSQL DB enabled rapid and simplified implementation of new features.

== Smart Charging and Load-Balancing Concepts
<sec:sc-lb-soa>
In an installation like the HES-SO Energypolis Campus, it is essential to comply with certain electrical consumption rules. As mentioned above, the charging stations are distributed among several power supply groups with a fixed consumption limit. Exceeding this limit could trigger the circuit breakers, thereby cutting off all active charging on the group. Currently, each charger is allocated a fixed share of the available power that it must never exceed. So, if only one charger is active, it will still be throttled to the previously defined power share. A more effective approach would be to dynamically define the limits based on the number of active stations within the same block.

*Static allocation:* If on a 22kW power block there are 3 chargers but only one is active, it will only have 7.3 kW.

*Dynamic allocation:* if on a 22kW power block there are 3 chargers but only one is active, it will have the full 22kW available. When another charging session starts, the limits will then be redefined to allocate 11kW to each session.

However, it happens that a vehicle consumes less than the limit applied to the station, particularly if the vehicle is less performant than the station or if it is nearing the end of its charge. In a context of shared power among multiple vehicles, this can lead to a scenario where a station "wastes" energy, unnecessarily slowing down the charging of other vehicles. This is where the concept of "Smart Charging" comes into play. An algorithm will be responsible for detecting the under-consumption of the stations by comparing the consumption measures to the applied limit, in order to recalculate the limits in real time.

To communicate its limits to the stations, OCPP provides a series of possible instructions via the "SetChargingProfile". It is possible to send two types of charging profiles to the stations: the default charging profile, applied at the beginning of each session, and the direct charging profile, which dynamically changes the consumption limit for an active session. The details of the sending methods as well as the format will be detailed in @sec:smart-charging-service.