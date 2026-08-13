#import "/metadata.typ": *
#pagebreak()
= Testing, Validation and Results
<sec:tests-validation>

//#lorem(30)

#option-style(type:option.type)[
Contenu attendu
- *Méthode :* Définition de la méthode de test (utilisation des 5 simulateurs EVerest).
- *Scénario :* Déroulement d'un scénario de test complexe (ex. : branchement successif de 5 voitures, saturation du bloc de puissance, puis départ d'une voiture).
- *Validation physique :* Validation sur le terrain avec les 2 chargeurs DC.

Illustrations à prévoir
#block(fill: luma(245), inset: 12pt, radius: 4pt, width: 100%)[
  - *Graphique de validation (Smart Charging) :* Courbes générées à partir des logs réels montrant l'adaptation des limites de courant au fil du temps.
  - *Captures d'écran de validation :* L'interface réagissant en direct lors des phases critiques de test.
]
]

== Test Methodology and Environments

System validation was performed across three distinct environments to ensure comprehensive coverage of use cases.

The first environment, purely simulated, relies on five virtual EVerest stations. This framework allowed for the configuration of strict constraints, such as a power block artificially limited to 22A, to force and observe the saturation behaviors of the load-balancing algorithm. The Node-RED code of these simulators was also modified to allow the injection of various RFID identifiers. The procedure to modify the Node-RED code can be found in @appendix-a.

The second environment is a hardware test bench consisting of a Zaptec Go station coupled with a Metrel electric vehicle simulator. This equipment made it possible to electrically manipulate the states of the station and simulate charging sessions without requiring the presence of an actual vehicle, thereby validating the system's responsiveness to real hardware events.

The third environment corresponds to the production infrastructure, composed of the GreenMotion chargers in the HES-SO parking lot. Tests on this hardware were conducted in a targeted manner, focusing on basic functionalities so as not to disrupt service availability for daily users.

== Smart Charging Validation (Load-Balancing)

In order to evaluate the behavior of the dynamic distribution algorithm, the tests were divided into two distinct scenarios. The curves presented below were generated from the raw execution logs of the Smart Charging service, excerpts of which are available in @appendix-b.

The following chronograms illustrate the logical sequence of events. The x-axis represents event triggers, such as vehicle plug-ins, charging stops, or the detection of consumption variations, rather than a strictly proportional time scale. In the background, the service executes a regulation loop clocked at a fixed interval of 30 seconds to evaluate the state of the network.

=== Scenario A: Saturation and Prioritization

This first scenario validates the management of the maximum limit of a power supply group. On a block limited to 22A, three stations are activated successively. The system allocates the available power to them, favoring the station configured with the highest priority. When a fourth station requests a charge, the algorithm detects that the vital minimum of 6A can no longer be guaranteed for everyone, as the required sum exceeds the 22A limit. The fourth station is therefore placed on standby. Once one of the three active stations is manually deactivated, the released current allows the fourth station to automatically start its session.

For stations under the OCPP 1.6J protocol, sending charging profiles respects a minimum delay of 5 minutes between two consecutive instructions to avoid degrading the physical contactors; this constraint is ignored only during a 0A cut-off.

#figure(
  align(center)[
    #block(width: 400pt, height: 240pt)[
      // Fonctions d'échelle : X(temps), Y(courant)
      #let X(t) = t * 38pt
      #let Y(c) = 220pt - (c * 8pt)

      #let polyline(points, stroke: 1pt) = {
        for i in range(0, points.len() - 1) {
          place(std.line(start: points.at(i), end: points.at(i + 1), stroke: stroke))
        }
      }

      // Axes
      #place(std.line(start: (X(0), Y(0)), end: (X(10.5), Y(0)), stroke: 1.2pt))
      #place(std.line(start: (X(0), Y(25)), end: (X(0), Y(0)), stroke: 1.2pt))

      // Labels de l'axe X (Temps)
      #place(dx: X(0.5) - 5pt, dy: Y(0) + 10pt, [*t0*])
      #place(dx: X(1.5) - 5pt, dy: Y(0) + 10pt, [*t1*])
      #place(dx: X(2.5) - 5pt, dy: Y(0) + 10pt, [*t2*])
      #place(dx: X(3.5) - 5pt, dy: Y(0) + 10pt, [*t3*])
      #place(dx: X(5.0) - 5pt, dy: Y(0) + 10pt, [*t4*])
      #place(dx: X(6.5) - 5pt, dy: Y(0) + 10pt, [*t5*])
      #place(dx: X(8.0) - 5pt, dy: Y(0) + 10pt, [*t6*])
      #place(dx: X(9.5) - 5pt, dy: Y(0) + 10pt, [*t7*])

      // Labels de l'axe Y (Courant)
      #place(dx: -25pt, dy: Y(22) - 5pt, [22A])
      #place(dx: -25pt, dy: Y(15) - 5pt, [15A])
      #place(dx: -25pt, dy: Y(11) - 5pt, [11A])
      #place(dx: -20pt, dy: Y(7) - 5pt, [7A])

      // Ligne de capacité max (Rouge)
      #place(std.line(start: (X(0), Y(22)), end: (X(10.5), Y(22)), stroke: (paint: red, thickness: 1.5pt, dash: "dashed")))

      // cp001 (Bleu) - Poids 1
      #polyline(
        ((X(0), Y(0)), (X(0.5), Y(0)), (X(0.5), Y(22)), (X(1.5), Y(22)), (X(1.5), Y(7)), (X(2.5), Y(7)), (X(2.5), Y(6.15)), (X(6.5), Y(6.15)), (X(6.5), Y(11.15)), (X(8.0), Y(11.15)), (X(8.0), Y(22)), (X(9.5), Y(22)), (X(9.5), Y(0))),
        stroke: (paint: blue, thickness: 2pt)
      )

      // cp002 (Vert) - Poids 2
      #polyline(
        ((X(0), Y(0)), (X(1.5), Y(0)), (X(1.5), Y(15)), (X(2.5), Y(15)), (X(2.5), Y(10)), (X(6.5), Y(10)), (X(6.5), Y(0))),
        stroke: (paint: green, thickness: 2pt)
      )

      // cp003 (Orange) - Poids 1
      #polyline(
        ((X(0), Y(0)), (X(2.5), Y(0)), (X(2.5), Y(6)), (X(5), Y(6)), (X(5), Y(0)), ),
        stroke: (paint: orange, thickness: 2pt)
      )

      // cp004 (Violet) - Poids 1
      #polyline(
        ((X(0), Y(0)), (X(3.5), Y(0)), (X(5.06), Y(0)), (X(5.06), Y(6)), (X(6.5), Y(6)), (X(6.5), Y(11)), (X(8.0), Y(11)), (X(8.0), Y(0))),
        stroke: (paint: purple, thickness: 2pt)
      )

      #place(top + right, dx: -150pt, dy: 10pt)[
        #rect(fill: white, stroke: 0.5pt + luma(180), radius: 3pt, inset: 8pt)[
          #set text(size: 9pt) // Taille de police réduite pour la légende
          #grid(
            columns: (20pt, auto),
            row-gutter: 8pt,
            align: (center + horizon, left + horizon),
            
            std.line(length: 15pt, stroke: (paint: blue, thickness: 2pt)), [cp001 (Standard priority)],
            std.line(length: 15pt, stroke: (paint: green, thickness: 2pt)), [cp002 (High priority)],
            std.line(length: 15pt, stroke: (paint: orange, thickness: 2pt)), [cp003 (Standard priority)],
            std.line(length: 15pt, stroke: (paint: purple, thickness: 2pt)), [cp004 (Standard priority)]
          )
        ]
      ]
    ]
  ],
  caption: [Chronogram of topological changes and weight-based distribution (Scenario A).]
) <fig-smartcharging-scenario-a>

- `t0`: Activation of cp001. Being the only one, it receives the maximum group allocation (22A).
- `t1`: Activation of cp002 (with a priority weight of 2). The load is distributed: cp001 drops to 7A, and cp002 takes 15A.
- `t2`: Activation of cp003 (weight of 1). New total balancing divided according to weights (cp001: 6A, cp002: 10A, cp003: 6A).
- `t3`: Activation of cp004 (weight of 1). Since the maximum capacity of 22A is fully distributed, it is placed in the queue (0A).
- `t4`: Deactivation (stop) of cp003. Its session ends, which frees up current and allows cp004 to exit the queue by recovering 6A.
- `t5`: Deactivation (stop) of cp002. Load-balancer adjustment: the free power is distributed equally between the remaining active stations, namely cp001 (11A) and cp004 (11A).
- `t6`: Deactivation (stop) of cp004. cp001, once again alone, recovers the total power (22A).
- `t7`: Deactivation (stop) of cp001. End of all charging sessions on the group.

=== Scenario B: Under-consumption and Redistribution

The second scenario focuses on optimizing unused power. Two stations are initially active and share the available power. The consumption of one of the simulators is then manually reduced using its web interface to simulate an end of charge or a vehicle reaching its internal hardware limit.

To ensure that telemetric measurements are stabilized after a new instruction is transmitted, the algorithm applies a delay before validating an under-consumption state. This observation delay is set to 90 seconds for equipment operating under OCPP 2.0.1 and above, and to 210 seconds for equipment under OCPP 1.6. Once this delay has elapsed, the algorithm lowers the limit allocated to the under-consuming station and immediately redistributes the virtually recovered amperes to the other active stations. The system continues to monitor consumption during its 30-second loops and dynamically readjusts the limits as demand increases again.

#figure(
  align(center)[
    #block(width: 400pt, height: 240pt)[
      #let X(t) = t * 38pt
      #let Y(c) = 220pt - (c * 8pt)

      #let polyline(points, stroke: 1pt) = {
        for i in range(0, points.len() - 1) {
          place(std.line(start: points.at(i), end: points.at(i + 1), stroke: stroke))
        }
      }

      // Axes
      #place(std.line(start: (X(0), Y(0)), end: (X(10), Y(0)), stroke: 1.2pt))
      #place(std.line(start: (X(0), Y(25)), end: (X(0), Y(0)), stroke: 1.2pt))

      // Labels X
      #place(dx: X(0.5) - 5pt, dy: Y(0) + 10pt, [*t0*])
      #place(dx: X(1.5) - 5pt, dy: Y(0) + 10pt, [*t1*])
      #place(dx: X(3.0) - 5pt, dy: Y(0) + 10pt, [*t2*])
      #place(dx: X(4.2) - 5pt, dy: Y(0) + 10pt, [*t3*])
      #place(dx: X(5.4) - 5pt, dy: Y(0) + 10pt, [*t4*])
      #place(dx: X(6.6) - 5pt, dy: Y(0) + 10pt, [*t5*])
      #place(dx: X(7.8) - 5pt, dy: Y(0) + 10pt, [*t6*])
      #place(dx: X(8.8) - 5pt, dy: Y(0) + 10pt, [*t7*])
      #place(dx: X(9.6) - 5pt, dy: Y(0) + 10pt, [*t8*])

      // Labels Y
      #place(dx: -25pt, dy: Y(22) - 5pt, [22A])
      #place(dx: -25pt, dy: Y(15) - 5pt, [15A])
      #place(dx: -25pt, dy: Y(11) - 5pt, [11A])
      #place(dx: -20pt, dy: Y(6) - 5pt, [6A])

      #place(std.line(start: (X(0), Y(22)), end: (X(10), Y(22)), stroke: (paint: red, thickness: 1.5pt, dash: "dashed")))

      // Limite cp001 (Bleu solide)
      #polyline(
        ((X(0), Y(0)), (X(0.5), Y(0)), (X(0.5), Y(22)), (X(1.5), Y(22)), (X(1.5), Y(11)), (X(3.0), Y(11)), (X(3.0), Y(7)), (X(4.2), Y(7)), (X(4.2), Y(8)), (X(5.4), Y(8)), (X(5.4), Y(9)), (X(6.6), Y(9)), (X(6.6), Y(10)), (X(7.8), Y(10)), (X(7.8), Y(11)), (X(8.8), Y(11)), (X(8.8), Y(22)), (X(9.6), Y(22)), (X(9.6), Y(0))),
        stroke: (paint: blue, thickness: 2pt)
      )

      // Conso réelle cp001 (Bleu pointillé) - Déclencheur des ajustements
      #polyline(
        ((X(0.5), Y(0)), (X(0.8), Y(20)), (X(1.5), Y(10)), (X(1.8), Y(6.06)), (X(3.0), Y(6.06)), (X(3.6), Y(6.95)), (X(4.2), Y(6.95)), (X(4.8), Y(7.93)), (X(5.4), Y(7.93)), (X(6.0), Y(8.95)), (X(6.6), Y(8.95)), (X(7.2), Y(9.5)), (X(7.8), Y(9.5)), (X(8.3), Y(11)), (X(9.6), Y(11)), (X(9.6), Y(0))),
        stroke: (paint: blue, thickness: 1.5pt, dash: "dotted")
      )

      // Limite cp002 (Vert solide)
      #polyline(
        ((X(0), Y(0)), (X(1.5), Y(0)), (X(1.5), Y(11)), (X(3.0), Y(11)), (X(3.0), Y(15)), (X(4.2), Y(15)), (X(4.2), Y(14)), (X(5.4), Y(14)), (X(5.4), Y(13)), (X(6.6), Y(13)), (X(6.6), Y(12)), (X(7.8), Y(12)), (X(7.8), Y(11)), (X(8.8), Y(11)), (X(8.8), Y(0))),
        stroke: (paint: green, thickness: 2pt)
      )

      #place(top + right, dx: -150pt, dy: 30pt)[
        #rect(fill: white, stroke: 0.5pt + luma(180), radius: 3pt, inset: 8pt)[
          #set text(size: 9pt) // Taille de police réduite pour la légende
          #grid(
            columns: (20pt, auto),
            row-gutter: 8pt,
            align: (center + horizon, left + horizon),
            
            std.line(length: 15pt, stroke: (paint: blue, thickness: 2pt)), [cp001 (Standard priority)],
            std.line(length: 15pt, stroke: (paint: green, thickness: 2pt)), [cp002 (Standard priority)],
          )
        ]
      ]
    ]
  ],
  caption: [Optimization chronogram by under-consumption detection (Scenario B). The blue dotted line represents the actual consumption of cp001.]
) <fig-smartcharging-scenario-b>

- `t0`: Activation of cp001 (22A allocated as it is alone).
- `t1`: Activation of cp002. Default balancing distributes power to 11A for each station.
- `t2`: The algorithm detects significant under-consumption from cp001 (which draws only about 6A despite its authorized 11A). The limit allocated to cp001 is lowered to 7A, and the surplus (4A) is automatically reassigned to cp002 (which goes to 15A).
- `t3 to t5`: The current demand of cp001 gradually increases. At regular intervals, the algorithm observes this increase and restores its capacity in successive steps (8A, then 9A, then 10A) by dynamically subtracting it from cp002.
- `t6`: The consumption of cp001 has increased enough to require its initial 11A again. Both stations are rebalanced.
- `t7`: Deactivation (stop) of cp002. cp001 is once again alone on the network and regains the block's maximum limit (22A).
- `t8`: Deactivation (stop) of cp001. End of the charging scenario.

== Business Flow and Frontend Validation

The validation of business flows confirms that physical events are correctly processed by the software infrastructure and rendered in real time on the user interface.

Access management was tested by scanning various unregistered RFID cards on the EVerest simulators as well as on the Zaptec station. The system correctly intercepted the authorization denials. These badges instantly appeared in the platform's unknown badges management menu, proving the proper functioning of identifier retrieval within OCPP messages.

#figure(
  image("../resources/img/unknown_badges.png", width: 100%),
  caption: [Dashboard showing the menu for adding unknown badges.],
) <fig:unknown_badges>

The detection of inactive sessions was validated using the Zaptec and Metrel environment and with the help of the EVerest simulators. A session was initiated with zero consumption. After the tolerance delay, configured to 20 minutes for this test, the service correctly toggled the transaction status, triggering the appearance of a visual illegality indicator on the supervision dashboard. This behavior was subsequently confirmed organically on the parking lot stations, when users forgot to unplug.

#figure(
  image("../resources/img/illegal_session.png", width: 100%),
  caption: [Dashboard showing the visual indicator of an inactive or illegal session.],
) <fig:illegal_session>

These various critical events also made it possible to confirm the reliability of the alerting system, with each anomaly successfully triggering the notification routines planned in the centralized architecture. In order to verify and supervise these alerts, a personal email address was blind carbon copied on all notifications, making it possible to confirm the proper receipt of alert messages by the school staff.

== Hardware Validation

The integration of the physical GreenMotion stations confirmed the hardware connectivity and the proper management of the OCPP 1.6J protocol by the central server. Fundamental operations such as starting a session, authentication, and stopping a charge were successfully validated on this equipment.

However, tests of intensive dynamic variations related to Smart Charging were deliberately avoided on these specific stations. Since periods of simultaneous use of these chargers are rare, and the hardware had demonstrated a certain sensitivity to instruction changes, it was deemed preferable to guarantee the absolute stability of the infrastructure for the school staff rather than risk contactor errors in a production environment.

== Results Analysis (Objectives Verification)

The overall analysis of the tests confirms that the developed system meets the requirements set by the initial specifications. To objectively evaluate the success of the project, the obtained results are directly mapped to the mandatory and optional objectives defined at the beginning of the mandate.

=== Validation of Main Objectives (Must-have)

- Analysis and state of the art: The comparative study of charging modes and communication protocols was successfully conducted, confirming the relevance of using the OCPP standard.
- Technical infrastructure audit: The Campus charger fleet was fully audited, highlighting the hardware and network limitations of the original installation.
- Management platform analysis: Several open-source solutions were evaluated, leading to the strategic choice of CitrineOS for its modular architecture.
- Definition of OCPP architecture and infrastructure: The centralized system was successfully deployed. It simultaneously manages multiple clients, integrates access management, and ensures secure user authentication.
- Development of a supervision Dashboard: A comprehensive web interface was created. It provides real-time consumption tracking, user history, an administration interface, and NFC identifier management.
- Report writing and technical documentation: The production of this document, coupled with code documentation, validates this reporting requirement.

=== Validation of Optional Objectives (Nice to have)

- Load distribution algorithm: This objective was fully met. A dynamic load-balancing algorithm was designed, implemented, and successfully validated in a simulation environment, enabling the optimization of the electrical power available on site.
- Retrofitting old charging stations: Due to the technical complexity related to converting OCPP 1.4 to Modbus TCP, this step was not completed during this work and was documented as an area for improvement.
- Advanced billing management: This feature was not prioritized over the development of Smart Charging and remains a future evolution path for integration with the school's administrative systems.

=== Additional Features

In addition to the specifications, several features not initially planned were developed during the project. The traceability of unknown badges, the detection of inactive sessions, and the modular configuration of power blocks were successfully implemented. These additions provide significant operational value to this proof of concept, making it ready for concrete and future operation.

