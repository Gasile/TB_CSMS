#import "@preview/fletcher:0.5.6" as fletcher: diagram, node, edge, shapes
#import "/metadata.typ": *
#pagebreak()
= Global System Architecture
<sec:architecture-globale>

#option-style(type:option.type)[
Contenu attendu
- Topologie : Explication de la topologie du réseau et de l'intégration des différents blocs (Frontend, Backend, DB, Bornes physiques, Simulateurs).
- Contraintes locales : Justification de l'utilisation d'un serveur Linux local et des contraintes liées (ex. : absence d'internet bloquant le notification-service).

Illustrations à prévoir
#block(fill: luma(245), inset: 12pt, radius: 4pt, width: 100%)[
  - Diagramme d'architecture système (Crucial) : Un schéma haut niveau montrant comment CitrineOS, la base de données PostgreSQL, les microservices Go et l'interface React communiquent entre eux, avec les bornes aux extrémités.
]
]

== System Overview and technology Stack

Deployed on a Linux server, CitrineOS is provided with a PostgreSQL database and an intermediary API engine, Hasura, allowing data to be distributed to the frontend. The microservices run in parallel and receive the desired information from the database via a series of Event Triggers, configured from the Hasura web interface, and write to the tables via SQL commands. The Smart Charging service also communicates the charging profiles via the CitrineOS API. The five EVerest simulators communicate with CitrineOS in OCPP via an internal Docker network. The Zaptec station is connected via WebSocket through port 8081, while the GreenMotion stations communicate via a local subnet (LAN) of the HES configured by the IT department.

#v(-1.5em)
#figure(
  gap: -0.7em,
  caption: [CSMS System Architecture - Energypolis Campus],
  scale(85%,
    diagram(
      spacing: (2.2cm, 1.9cm),
      node-stroke: 1pt,
      edge-stroke: 0.8pt + luma(80),

      node((1.5, 0.8), stroke: 1pt + blue, fill: white, corner-radius: 4pt, 
        box(width: 3.8cm, align(center)[
          React Frontend \
          #text(8pt)[Dashboard / Supervision]
        ])
      ),

      node((-0.8, 1.9), stroke: 1pt + red, fill: white, corner-radius: 4pt, 
        box(width: 3cm, align(center)[
          CitrineOS \
          #text(8pt)[(CSMS)]
        ])
      ),
      
      node((-0.8, 0.8),shape: rect, stroke: 1pt + red, fill: white, corner-radius: 4pt, 
        box(width: 3cm, [
          #text(0.1pt)[
            \
          ]
          #align(center)[PostgreSQL]
          #v(-4pt)
          #line(length: 100%, stroke: 0.5pt + gray)
          #text(7.5pt)[
            • Users \
            • UserBadges \
            • PowerBlocks \
            • UnknownBadges \
            \
          ]
        ])
      ),

      node((0.5, 0.4), stroke: 1pt + red, fill: white, corner-radius: 4pt, 
        box(width: 3cm, align(center)[
          Hasura \
          #text(8pt)[GraphQL Engine]
        ])
      ),

      node((0.5, 1.2), stroke: 1pt + red, fill: white, corner-radius: 4pt, 
        box(width: 3cm, align(center)[
          Go Microservices \
          #text(8pt)[Smart Charging]
        ])
      ),

      node((-1.6, 2.7), stroke: 1pt + green, fill: white, corner-radius: 4pt, 
        box(width: 2.8cm, align(center)[
          Zaptec Station \
          #text(8pt)[Cloud / WAN]
        ])
      ),
      
      node((-0.8, 2.7), stroke: 1pt + green, fill: white, corner-radius: 4pt, 
        box(width: 2.8cm, align(center)[
          GreenMotion (x2) \
          #text(8pt)[LAN HES]
        ])
      ),
      
      node((-0.05, 2.7), stroke: 1pt + green, fill: white, corner-radius: 4pt, 
        box(width: 2.8cm, align(center)[
          EVerest (x5) \
          #text(8pt)[Docker Simulators]
        ])
      ),
      
      edge((1.5, 0.7), (1.5, 0.4), (0.6, 0.4), [GraphQL], "<->", label-pos: 0.7),
      edge((1.5, 0.9), (1.5, 1.2), (0.6, 1.2), [REST API], "<->", label-pos: 0.7),

      edge((-0.8, 1.8), (-0.8, 1.1), [SQL], "<->"),
      edge((-0.5, 0.7), (-0.3, 0.7), (-0.3, 0.4), (0.2, 0.4), [DB Native], "<->"),
      edge((-0.5, 0.95), (-0.3, 0.95), (-0.3, 1.2), (0.2, 1.2), [SQL], "<->", label-side: left),
      edge((0.3, 0.5), (0.3, 1.2), [Event Triggers], "->", label-side: left),
      edge((0.4, 1.3), (0.4, 1.6), (-0.55, 1.6), (-0.55, 1.8), [API / Profiles], "->"),

      edge((-1.55, 2.7), (-1.55, 1.9), (-1.15, 1.9), [OCPP (WAN)], "<->", label-side: left),
      edge((-0.8, 2.7), (-0.8, 1.9), [OCPP (LAN)], "<->"),
      edge((-0.05, 2.7), (-0.05, 1.9), (-0.6, 1.9), [OCPP (Docker)], "<->", label-side: right),
    )
  )
)

The language chosen for the development of the external microservices is Go (Golang). This compiled language offers extremely fast execution times and very low memory consumption (RAM/CPU) compared to environments like Node.js, Python, or Java. Furthermore, native concurrency management allows the microservices to easily process a large number of events and requests simultaneously.

The frontend, on the other hand, was developed with the React library. It is the most popular industry standard for web interface development. Due to this predominance, large language models (LLMs) have been trained on a massive volume of high-quality React code. This synergy with artificial intelligence significantly accelerates interface prototyping and effectively integrates most features (A detailed description of the Artificial Intelligence tools used and their framework of use is available in @appendix-e).

== Requirements Specification

This work is divided into two main objectives. First, the deployment of CitrineOS and its surrounding ecosystem (Hasura/PostgreSQL). The system must detect connected charging stations, handle charger control, and ensure the management of charging sessions and access.

Second, the development of a supervision Dashboard. This platform must allow for real-time monitoring of consumption and the general state of the station fleet. It must also manage user access to the stations, as well as global administrator supervision of the system (management of chargers, users, and NFC/RFID badges).

Among the secondary objectives, the Smart Charging and load-balancing algorithm was selected and fully implemented. Several additional features (spontaneous or required during development) were also added, such as user profile management, unknown badge management, the notification system, inactive session detection, and the detailed configuration of power supply groups.

== Database Design
The structure of CitrineOS's native PostgreSQL database had to be extended several times to effectively meet the specific needs of this work. A diagram detailing the modified part of the database structure is presented in @appendix-c.

By default, the database manages NFC badges (via the Authorization table) but not their ownership by a specific user. The first extension was therefore the complete storage of users (personal information and login credentials) as well as their link to the badges. To facilitate implementation and modularity, a Users table was created, then linked to a UserBadges join table. This architecture allows a user to own multiple badges, while ensuring that a badge can only belong to one user at a time.

In the initial structure, the only linking information contained in the Transactions table (representing charging sessions) is the badge used. Since a badge can now change owner, an explicit link had to be added between the charging session and the badge owner at the time the session was initiated.

The management of power supply groups also required an extension via the addition of the PowerBlocks table. This table contains the electrical characteristics of a block (maximum current, voltage, maximum power). To link these blocks to the different stations, a power_block_id column was added to the ChargingStations table. It is to these data that the Smart Charging algorithm refers for the dynamic adjustment of consumption limits. To ensure the reliability of controlling these limits, an allocated_limit column was also added to the Transactions table.

The storage of unrecognized badges required the addition of an UnknownBadges table. This avoids having to parse the entire history of OCPP communications to find these events. This table only contains the NFC identifier of the badge, the timestamp of its detection by the station, and the number of scan attempts.

Finally, the Transactions table received a final adjustment: the is_legal (validity status) and overtime_start_timestamp columns were implemented to mark a charging session as inactive and to record the exact moment when the transaction stopped consuming energy.

== Backend and Communication Architecture

For the microservices to detect changes in the database, the first solution considered would have been polling. This solution could have worked but would have generated far too many unnecessary requests. To overcome this, an event-driven architecture based on Event Triggers was configured in Hasura. 

An Event Trigger automatically detects a change in a database element (entire table or specific column) and generates HTTP POST requests (Webhooks) targeting the internal ports of the microservices. This ensures that business logic is executed only when data evolves in the database, thereby optimizing the use of system resources.

Here is the configuration of the event triggers for each domain of the system:

For Session Monitoring (idle-service):
- track_transactions : Transactions (INSERT, UPDATE) \ targeting http://tb_csms-idle-service:8080/webhook
- track_metervalues : MeterValues (INSERT) \ targeting http://tb_csms-idle-service:8080/webhook

For Access Control (badge-service):
- track_ocpp_messages : OCPPMessages (INSERT) \ targeting http://badge-service:8082/webhooks/messages

For Dynamic Charge Management (smart-charging-service):
- smart_charging_transactions : Transactions (INSERT, UPDATE) on the isActive column \ targeting http://smart-charging-service:8081/webhooks/transactions
- smart_charging_power_blocks : PowerBlocks (UPDATE) on the max_a, n_phase, max_v columns \ targeting http://smart-charging-service:8081/webhooks/transactions 
- evse_assignment_trigger : ChargingStations (INSERT, UPDATE) on the power_block_id, protocol columns \ targeting http://smart-charging-service:8081/webhooks/station-assignment
- smart_charging_station_reconnection : ChargingStations (UPDATE) on the isOnline column \ targeting http://smart-charging-service:8081/webhooks/transactions
- station_weight_trigger : ChargingStations (INSERT, UPDATE) on the weight, power_block_id columns \ targeting http://smart-charging-service:8081/webhooks/transactions

For the Alert System (notification-service):
- notify_password_reset : Users (UPDATE) on the reset_token column \ targeting http://notification-service:8084/webhooks/notify
- notify_unknown_badge : UnknownBadges (INSERT) \ targeting http://notification-service:8084/webhooks/notify
- notify_idle_transaction : Transactions (UPDATE) on the is_legal column \ targeting http://notification-service:8084/webhooks/notify
- notify_wait_for_energy : Transactions (UPDATE) on the allocated_limit column \ targeting http://notification-service:8084/webhooks/notify
- notify_connector_error : Connectors (UPDATE) on the errorCode column \ targeting http://notification-service:8084/webhooks/notify
#pagebreak()
== Security and Access Design

Given that the architecture relies on Hasura as the primary engine for exposing the database, security must be managed decentrally. Hasura entirely delegates identity verification to an external component that acts as an authentication provider. 

The chosen integration design relies on issuing a JWT token. This token is designed to include a JSON object into which the context variables essential for Hasura are injected, namely x-hasura-user-id, x-hasura-default-role, and x-hasura-allowed-roles. It is the presence of these variables, sealed in the token, that allows Hasura to automatically apply the security rules configured on the various database tables during GraphQL requests issued from the frontend.

#figure(
  diagram(
    node-stroke: 1pt,
    edge-stroke: 1pt,
    
    node((-0.4,0), [Frontend], shape: rect, width: 3cm),
    node((1,0), [Auth Service (Go)], shape: rect, width: 4cm),
    node((2.4,0), [Hasura (DB)], shape: rect, width: 3cm),

    edge((-0.4,0), (-0.4,10.2), stroke: (dash: "dashed")),
    edge((1,0), (1,10.2), stroke: (dash: "dashed")),
    edge((2.4,0), (2.4,10.2), stroke: (dash: "dashed")),

    node((0.3, 0.5), text(weight: "bold", fill: blue)[1. Connection Flow (Login)], stroke: none),
    
    edge((-0.4,1.6), (1,1.6), "->", label: [POST `/api/login` \ (email, password)]),
    
    edge((1,2), (1,2.5), "->", label: [SHA-256 Hash], bend: -90deg),
    
    edge((1,2.9), (2.4,2.9), "->", label: [GraphQL Query \ (`GetUser`)]),
    edge((2.4,3.6), (1,3.6), "->", label: [JSON (User Data)]),
    
    edge((1,4), (1,4.5), "->", label: [Generate JWT \ (Hasura claims)], bend: -90deg),
    
    edge((1,5.7), (-0.4,5.7), "->", label: [200 OK \ (JWT Token + User info)]),

    node((0.3, 6), text(weight: "bold", fill: green)[2. Protected Route Flow], stroke: none),
    
    edge((-0.4,7), (1,7), "->", label: [POST `/api/profile/...` \ Header: `Bearer JWT`]),
    
    edge((1,7.4), (1,7.9), "->", label: [`authMiddleware` \ (Validates JWT)], bend: -90deg),
    
    edge((1,8.7), (2.4,8.7), "->", label: [GraphQL Mutation \ (Update User)]),
    edge((2.4,9.4), (1,9.4), "->", label: [JSON (`affected_rows`)]),
    
    edge((1,9.8), (-0.4,9.8), "->", label: [200 OK])
  ),
  caption: [Sequence diagram for authentication and authorization.]
)
#pagebreak()
== Session Monitoring Logic

The monitoring of charging session activity relies on a state machine modeling, distinguishing legal sessions from violating sessions. A transaction transitions from a legal state to a violation state when the vehicle occupies the spot without consuming energy beyond an authorized grace period. Conversely, the effective resumption of energy transfer resets the monitoring and maintains or restores the compliant status of the session.

#figure(
  image("../resources/img/state-diagram.drawio.pdf", width: 68%),
  caption: [State diagram for transaction management.]
)

#v(-0.2em)

The raw algorithmic logic to process this transition relies on querying the allocated limit and managing a timer whose expiration validates or invalidates the violation.

#figure(
  diagram(
    spacing: (12mm, 10mm),
    node-stroke: 1pt + rgb("#2d3748"),
    edge-stroke: 1pt + rgb("#4a5568"),
    
    node((0,0), [Timer Trigger], shape: shapes.pill, fill: rgb("#edf2f7"), name: <func_start>),
    node((0,0.8), [DB Query \ `fetchAllocatedLimit(txID)`], shape: shapes.rect, corner-radius: 3pt, fill: rgb("#ebf8ff"), name: <fetch>),
    node((0,1.6), [Limit `== 0.0` ?], shape: shapes.diamond, name: <check>),
    
    node((-1,1.6), [
      Wait for energy \
      Log info & Reset timer \ `startOrResetTimer(txID)`
    ], shape: shapes.rect, corner-radius: 3pt, fill: rgb("#ebf8ff"), name: <wait_energy>),

    node((0,2.6), [
      Mark as Violation \
      `markTransactionAsIllegal(txID)`
    ], shape: shapes.rect, corner-radius: 3pt, fill: rgb("#fff5f5"), stroke: 1pt + rgb("#e53e3e"), name: <mark_illegal>),

    node((0,3.4), [
      Memory Cleanup
    ], shape: shapes.rect, corner-radius: 3pt, fill: rgb("#edf2f7"), name: <cleanup>),

    node((0,4.2), [End of procedure], shape: shapes.pill, fill: rgb("#edf2f7"), name: <func_end>),

    edge(<func_start>, <fetch>, "->"),
    edge(<fetch>, <check>, "->"),
    edge(<check>, <wait_energy>, "->", label: [Yes (0A)], label-side: right),
    edge(<check>, <mark_illegal>, "->", label: [No (>0A)], label-side: left),
    edge(<wait_energy>, <fetch>, "->", bend: 15deg, label: [Reset]),
    edge(<mark_illegal>, <cleanup>, "->"),
    edge(<cleanup>, <func_end>, "->")
  ),
  caption: [Flowchart for inactivity verification.]
)

== Smart Charging Logic
The Smart Charging algorithm is divided into four distinct steps:

1. The first step determines whether a transaction can start consuming or not. The minimum current a charger must provide is set to 6A. If the available current in the relevant power block does not allow providing this minimum to all sessions, those with the lowest priority or the most recent arrival time are suspended.

2. Once a transaction is launched, a periodic verification of its consumption begins. The goal is to detect if a vehicle is consuming less than its allocated current (underloading phenomenon). If this is the case, the limit is redefined just above the vehicle's actual consumption.

3. After allocating the vital minimums or following the detection of an under-consuming vehicle, the remaining available current in the block is redistributed to active transactions based on the priority level of each station. Any remaining amperes, due to rounding during calculations, are then allocated to the highest priority stations.

4. During the testing phase with the physical OCPP 1.6J stations, the latter proved to be very intolerant of excessively frequent limit changes. Upon receiving a new instruction, these stations go through a transition phase where the transaction is suspended for approximately one minute. Sending a new instruction during this phase generally causes a hardware error. To overcome this problem, the limit of the OCPP 1.6J stations is only modified if the variation is at least 3A. Furthermore, a 5-minute cooldown period was imposed between each state change to prevent the station from constantly being in transition (with the exception of emergency cut-offs at 0A).

#v(0.7em)
#figure(
  align(center)[
    #block(width: 380pt, height: 250pt)[
      #let X(t) = t * 40pt
      #let Y(c) = 200pt - (c * 2pt)

      #let polyline(points, stroke: 1pt) = {
        for i in range(0, points.len() - 1) {
          place(std.line(start: points.at(i), end: points.at(i + 1), stroke: stroke))
        }
      }

      #place(std.line(start: (X(0), Y(0)), end: (X(9.6), Y(0)), stroke: 1.2pt))
      #place(std.line(start: (X(0), Y(105)), end: (X(0), Y(0)), stroke: 1.2pt))

      #place(dx: X(1) - 5pt, dy: Y(0) + 10pt, [t0 \ station 1 \ activation])
      #place(dx: X(4) - 5pt, dy: Y(0) + 10pt, [t1 \ station 2 \ activation])
      #place(dx: X(7) - 5pt, dy: Y(0) + 10pt, [t2 \ under-consumption \ detection])

      #place(dx: -25pt, dy: Y(100) - 5pt, [22A])
      #place(dx: -25pt, dy: Y(68) - 5pt, [15A])
      #place(dx: -25pt, dy: Y(50) - 5pt, [11A])
      #place(dx: -20pt, dy: Y(31) - 5pt, [7A])

      #place(std.line(start: (X(0), Y(100)), end: (X(9.6), Y(100)), stroke: (paint: red, thickness: 1.5pt)))
      #place(std.line(start: (X(0), Y(68)), end: (X(9.6), Y(68)), stroke: (paint: black, thickness: 1pt, dash: "dashed")))
      #place(std.line(start: (X(0), Y(31)), end: (X(9.6), Y(31)), stroke: (paint: black, thickness: 1pt, dash: "dashed")))

      #polyline(
        ((X(0), Y(0)), (X(1), Y(0)), (X(1), Y(100)), (X(4), Y(100)), (X(4), Y(50)), (X(7), Y(50)), (X(7), Y(31)), (X(9.6), Y(31)) ),
        stroke: (paint: blue, thickness: 2pt)
      )

      #polyline(
        ((X(0), Y(0)), (X(4), Y(0)), (X(4), Y(50)), (X(7), Y(50)), (X(7), Y(68)), (X(9.6), Y(68))),
        stroke: (paint: green, thickness: 2pt)
      )

      #polyline(
        ((X(1), Y(0)), (X(1.5), Y(95)), (X(3), Y(90)), (X(4), Y(50)), (X(6), Y(45)), (X(7), Y(28)), (X(9.6), Y(25))),
        stroke: (paint: blue, thickness: 1.5pt, dash: "dashed")
      )

      #polyline(
        ((X(4), Y(0)), (X(4.5), Y(45)), (X(6.5), Y(48)), (X(7), Y(48)), (X(7.5), Y(65)), (X(9.6), Y(66))),
        stroke: (paint: green, thickness: 1.5pt, dash: "dashed")
      )
    ]
  ],
  caption: [Chronogram illustrating the temporal evolution of current allocation by Smart Charging.]
)

== Alerting Rules and Routing

The alerting system defines strict routing rules to target the right recipients based on internal system trigger conditions:

- End of charge (Violation): Triggers when an ongoing transaction becomes illegal (inactivity). An email is sent to the targeted user asking them to move their vehicle which is unnecessarily occupying the space.
- Waiting for or resuming energy: Activates if the allocated current limit drops to zero or goes back above zero. The user owning the session is notified of the temporary interruption or the automatic resumption of their charge.
- Unknown badge: Triggered by the detection of a denied RFID connection attempt. An alert is routed to all system administrators to report the event, facilitating manual addition from the dashboard if the visitor is legitimate.
- Hardware error: Occurs when the operational state of a physical connector differs from its nominal state. Administrators are immediately alerted of the physical fault in order to plan a maintenance intervention.
- Password reset: Follows the generation of a security token on a profile. The concerned user receives a unique and temporary link allowing them to configure a new password.

Examples of Emails can be found in the @appendix-f.

== User Interface (UI) Design

=== User Interface
A standard user has access to three distinct tabs:
- Overview: This tab indicates the number of charging stations currently available in the parking lot. It also displays the user's active charging session(s) in real time (or the last session completed). General statistics are added, such as total consumption and a weekly breakdown over the last 16 weeks.
- My Sessions: This page provides access to the complete history of charging sessions performed by the user.
- My Badges: This section lists the RFID/NFC badges linked to the profile. The user has the ability to add new badges or modify existing ones.

=== Administrator Interface
For users with administrative permissions, four additional tabs are added to the standard interface:
- Supervision: This space allows for complete monitoring of the fleet. It displays the status of the chargers (active, available, offline), the instantaneous power consumed by the system, and the total energy distributed during the day. A graph traces the evolution of consumption over the last 24 hours, accompanied by the list of ongoing sessions.
- Charging Stations: This page lists all registered hardware. Here, it is possible to adjust the priority level of each charger, view the history of their sessions, and access the configuration of power blocks. Administrators can thus create, modify, or delete power supply groups and assign the corresponding stations to them.
- Badge Management: Similar to the user tab, this view allows the global management of all badges registered in the system as well as access to the session history filtered by badge.
- Users: This tab centralizes profile management. The administrator can modify personal information, adjust permission levels, and view a summary of transactions per user.

From any of these tabs, clicking on a transaction allows viewing its precise details. This view includes key figures (total consumption, duration) as well as the charging power variation curve. Administrators also have an activity log listing the technical events that occurred during the session (a feature exclusive to sessions operating under OCPP 2.0.1 and higher).

Finally, a tab dedicated to profile configuration allows any user to update their personal information, email address, and password.