#import "/metadata.typ": *
#pagebreak()

= Introduction
<sec:introduction>

== Context and Relevance
Today, electric mobility is experiencing significant growth, and the number of electric vehicles (EVs) on the roads continues to increase. Consequently, in 2021, HES-SO Valais-Wallis undertook a transition towards electric mobility by installing a fleet of charging stations on campus. This transition aimed to reduce the carbon footprint and promote the use of electric vehicles among its staff. This fleet of charging stations was made available to personnel with permission to use the campus's private parking lot.

Currently, this charging infrastructure comprises 12 Greenmotion brand chargers, including 10 AC chargers (22kW), one DC charger (22kW), and one DC charger (66kW). Since the Swiss company Greenmotion was acquired by the Eaton group in 2021, the maintenance of these stations in Switzerland is no longer optimally guaranteed. These chargers operate with communication protocols that are now obsolete (OCPP 1.4 and 1.6J), which makes supervising these stations very difficult. Furthermore, the lack of a centralized Charging Station Management System (CSMS) prevents HES-SO from effectively monitoring the usage of these stations. As it stands, it is impossible to know which station is active, who is charging, and the total consumption in real time. Added to this is the lack of power regulation. The chargers are distributed across several power supply groups and are limited equally based on the number of chargers in a group. Therefore, even if a single charger is active, it will not be able to charge at full power and will have to limit itself to its allocated share of power. This situation is problematic as it prevents full exploitation of the infrastructure, making the user experience frustrating and inefficient.

It is now essential to implement a supervision and intelligent management solution for this fleet of charging stations. Deploying a centralized management system (CSMS) will allow for effective monitoring of the comprehensive activity of users in the parking lot. It will then be possible to identify users, track their consumption, and react more quickly in the event of charger faults. Additionally, implementing an intelligent power distribution algorithm (Smart Charging) will optimize the power available to charging vehicles based on demand and grid availability.

== Objectives and Scope (Proof of Concept) 

The objective of this Bachelor's thesis is to design and implement a Proof of Concept (PoC) for a centralized supervision platform, based on the OCPP protocol, enabling effective and intelligent management of the campus's charging station fleet. This platform must present a comprehensive dashboard for real-time monitoring of the stations, user management, and RFID badges for authentication at the chargers.

To achieve this, an open-source CSMS was deployed on an internal HES-SO server. The chosen CSMS is CitrineOS, notably for its compatibility with OCPP 1.6 but also 2.0.1 and higher, which will greatly facilitate the potential modernization of the fleet with more modern chargers. A React frontend will also be developed and made accessible to all users to monitor fleet activity or simply check their own profile's current activity.
To this will be added various microservices running in parallel, enabling several things:
1. Secure authentication management for the frontend.
2. Detection of inactive charging sessions (power at 0W), which indicates that a vehicle is occupying a charger needlessly.
3. Registration of unknown badges scanned at the stations to facilitate adding them in the future.
4. Smart Charging management, effectively distributing the power allocated to each station.
5. Sending notifications to concerned users or administrators.

As mentioned above, the majority of the stations operate with version 1.4 of the OCPP protocol. Given the obsolescence of this version, direct integration into the current system would require an additional adaptation layer. Since OCPP 1.4 is quite cumbersome and limited, it is preferable to interact with these stations directly via their Modbus registers. To do this, a complete mapping of the sent messages and their OCPP equivalents must be undertaken. To ensure the quality and reliability of the previously listed features as well as compliance with time constraints, this Modbus adaptation has been put on hold for future work.
Given that only 2 stations operate with OCPP 1.6, in order to conduct tests on a larger fleet of stations, a total of 5 EVerest station simulators operating with OCPP 2.1 were deployed on the server. This allowed for more practical and rapid experimentation with services requiring multiple active stations, such as Smart Charging. The use of OCPP version 2.1 for the simulators has effectively prepared the current system for the future of this market.
In order to also study the behavior of OCPP 1.6 stations more directly, a Zaptec Go station was also set up at the workstation.

== Methodological Approach

The first step in carrying out this project was the deployment of a local version of CitrineOS. This allowed for practical and rapid experimentation to effectively implement the basic functionalities built around the CSMS. A first version of the frontend was created to quickly provide a conceptual visualization of what was possible.

Once the server was made available, a second, this time remote, version of CitrineOS was set up. To keep development simplified, the frontend remained local to benefit from React's dynamic updating (Hot-Reloading) in development mode, while communicating with the CitrineOS database via an SSH tunnel. The Go services were then developed one after another while keeping the frontend consistent with the new additions.

The entire system was kept up to date using the GitHub versioning system.

After the implementation of each feature, the EVerest simulators and the Zaptec charger served as a test bench, allowing almost immediate experimentation and validation of most features. The 2 OCPP 1.6 chargers in the parking lot were also quickly commissioned and linked to the CSMS to conduct tests in real-world conditions.

== Sustainability and SDG Alignment

This charging infrastructure modernization project not only responds to a technical need but actively contributes to HES-SO's sustainability approach by directly addressing three United Nations Sustainable Development Goals (SDGs).

=== SDG 7: Affordable and Clean Energy (Target 7.3 - Energy Efficiency)
The Smart Charging service enables effective energy optimization. Rather than statically limiting the power of each station, the system allocates maximum capacity to charging vehicles based on the number of active stations. It makes the use of the station fleet more dynamic while guaranteeing compliance with the power limits of each power group.

=== SDG 9: Industry, Innovation and Infrastructure (Target 9.4 - Upgrade infrastructure)
The adoption of the open standard OCPP (Open Charge Point Protocol) and the deployment of an Open Source CSMS allows the system to completely free itself from any dependence on a proprietary manufacturer. This open architecture guarantees the longevity of the installation, facilitates the integration of new stations (AC or DC), and ensures high adaptability to future technological developments.

=== SDG 11: Sustainable Cities and Communities (Targets 11.2 and 11.6 - Sustainable transport)
By offering centralized supervision and real-time monitoring of station availability, the platform makes the charging service more reliable for campus staff. This helps remove obstacles related to the daily use of electric vehicles, thereby encouraging the transition towards low-carbon mobility within HES-SO Valais-Wallis.

== Thesis Structure

The remainder of this document is structured as follows:
- State of the Art and Infrastructure Audit: Presents a comprehensive technical analysis of the technologies, protocols, and standards used throughout the project.
- Global System Architecture: Details the overall structure of the hardware and software infrastructure as a whole.
- Backend and Microservices Implementation: Explains in detail the implementation and configuration of CitrineOS as well as the Go microservices.
- Supervision Interface (Frontend): Covers the organization, implementation, and deployment of the user interface developed in React.
- Testing, Validation and Results: Presents a report on the testing and validation of all system components.
- Conclusion and Future Work: Synthesizes the results obtained and presents evolutionary perspectives for the future of this infrastructure.