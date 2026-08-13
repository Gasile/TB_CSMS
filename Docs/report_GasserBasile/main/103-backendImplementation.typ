#import "@preview/fletcher:0.5.6" as fletcher: diagram, node, edge, shapes
#import "/metadata.typ": *
#pagebreak()
= Backend and Microservices Implementation
<sec:implementation-backend>

#option-style(type:option.type)[
Contenu attendu
- CitrineOS & DB : Expliquer la modification du schéma de base de données (entités User, RFID, Session) pour supporter le besoin métier.
- Services Go : Expliquer la logique métier de l'idle-service, du badge-service, de l'auth-service et du notification-service (hors Smart Charging).
- Le cœur du système : Le smart-charging-service. Définir la notion de "Bloc de puissance" et expliquer la logique algorithmique de répartition dynamique.

Illustrations à prévoir
#block(fill: luma(245), inset: 12pt, radius: 4pt, width: 100%)[
  - Diagramme Entité-Relation (ERD) simplifié : Montrant les ajouts dans la base de données.
  - Diagramme de séquence ou d'état : Pour illustrer le cycle de vie d'une transaction avec l'idle-service ou le badge-service.
  - Pseudo-code ou Logigramme (Flowchart) : Uniquement pour l'algorithme décisionnel du Smart Charging.
]
]

== Development Methodology & Prototyping
The first step that had to be validated was the setup of CitrineOS. Once the minimal environment was deployed, along with an EVerest simulator to verify proper operation, an initial version of the Dashboard was developed. This version aimed to implement a preliminary user management system and an initial supervision interface including the management of charging stations and badges present in the system.

In a second phase, a Linux server was provisioned to deploy the system. Alongside this, the two DC chargers in the parking lot were also configured to communicate with this server. Once CitrineOS was deployed on it, a second version of the Dashboard was created, adding the details of charging sessions such as duration and consumption curves, and integrating a differentiation between user and administrator roles.

As the project progressed and adjustments were made, the microservices were implemented and tested with actual charging sessions on the physical stations where possible, while keeping the Dashboard updated to remain consistent with new features (such as the visualization of the inactive status).

During this development phase, the test environment featuring the five EVerest simulators enabled rapid and optimal work. Without direct access to the parking lot with a vehicle, any test requiring interaction with one or multiple stations (such as scanning an unknown badge or load balancing) could not have been conducted smoothly.

== Coding Practices and Go Architecture

To make the code lightweight and performant, Go's standard net/http library was used for the entire networking foundation. It allows for the straightforward creation of endpoints for the microservices to receive incoming requests, as well as to issue HTTP requests to other systems, such as GraphQL or REST APIs.

Through net/http, the Go HTTP server automatically launches a distinct goroutine for each incoming request. If a request triggers a lengthy process involving complex calculations or external API calls, keeping the HTTP connection open can lead to timeout errors. To mitigate this phenomenon, the endpoints simply receive the request data, launch the actual processing in a new dedicated goroutine, and then immediately return a 200 OK success code. This ensures that the microservices never block incoming network flows.

Since multiple goroutines run in parallel, they occasionally attempt to access the same memory variables or structures simultaneously. To prevent race conditions, the critical resources in the code are locked using sync.Mutex synchronization primitives. This forces the goroutines to wait until the memory area is released by the occupying goroutine before they can read or write data to it.

In the event of a request interruption or cancellation, Go goroutines lack an implicit native shutdown mechanism. The architecture therefore heavily leverages the context package. The latter is passed as a parameter throughout the entire call chain to propagate cancellation signals and manage timeouts. If a context is canceled, all goroutines associated with this context intercept the signal and terminate cleanly, thereby freeing up the CPU and memory.

To ensure the application's robustness when dealing with remote data, strict typing management was implemented via the definition of specific structs. To secure the decoding of JSON streams, custom serialization overrides were programmed. Unpredictable dynamic data is received via empty interfaces (interface{}) and then carefully manipulated using safe type assertions, thus avoiding any critical runtime errors (panics). Finally, the architecture maintains a strict separation of concerns: the code is divided into distinct modules separating HTTP handlers, the database communication layer, and software clients.

== Microservices Implementation Details
<sec:services-impl>

=== Authentication and Security (auth-service)
The implementation of the authentication service is based on the generation and validation of tokens according to industry standards. The code was structured around the standard golang/jwt/v5 library. When a login request provides valid credentials, the service constructs a JWT token by injecting user data into it, and cryptographically signs it using the HMAC-SHA256 algorithm paired with a secret key (JWT_SECRET) loaded from environment variables.

To protect profile modification operations within the REST API, a middleware named authMiddleware was coded. This component intercepts all requests directed towards the service's private routes before they reach their destination logic. Its implementation consists of extracting the value of the HTTP Authorization header, then syntactically verifying the presence of the Bearer prefix. The extracted token is then parsed by the Parse function of the JWT library, which mathematically validates the signature via the same secret key, while ensuring that the expiration property has not lapsed. If the token fails any of these checks or is missing, the middleware interrupts the processing chain and instantly returns an HTTP 401 Unauthorized response.

=== Session Monitoring (idle-service)

The implementation of the inactivity detection service relies on passive HTTP event handlers. The code executes only when the service receives a request on its endpoints configured to listen to the database.

The temporal monitoring logic was implemented using the time.AfterFunc function from Go's standard library. When a transaction starts or an active power measurement is reported, the service instantiates an asynchronous timer set to a duration defined by the GRACE_PERIOD_MINUTES environment variable. This function returns a pointer to a Timer object. To track these objects in memory, the service uses a map data structure associating the transaction identifier with its current timer, all protected by a Mutex.

If new consumption measurements are received for a vehicle, the service searches for the corresponding timer in the shared memory. The Stop() method is called on the instance to cancel its execution, then a new time.AfterFunc timer is recreated and assigned to the map. Finally, when an event signals the definitive end of the transaction, the timer is stopped if it was active, and the corresponding entry is permanently deleted from memory via the internal delete() function. This rigorous manual reference management guarantees the absence of memory leaks during the continuous operation of the application.

=== Access Control (badge-service)

The software implementation of the badge management service aims to intercept authorization denials. The main technical challenge lay in the fact that the error payloads transmitted by the system did not contain the character string (UID) of the offending badge.

To circumvent this lack of information, the code was structured to exploit the correlation identifier (correlationId) present in the error request. Upon receiving the failure message, the service compiles and executes a dynamic GraphQL query targeted at the communication history. This query uses the correlationId as a filter to retrieve the initial authorization request message. The service then parses the JSON response to extract the raw UID of the badge. The code then verifies its existence within the database structures via new queries, and performs a final insertion mutation if the badge must be registered as unknown.

=== Smart Charging (smart-charging-service)
<sec:smart-charging-service>

The implementation of the dynamic load management algorithm is based on the dynamic creation of lightweight processes. When a software update concerning a power block is detected via the HTTP entry points, an autonomous goroutine is instantiated specifically for the concerned block. This routine integrates an infinite calculation loop, clocked by Go's time.Ticker object.

To avoid the accumulation of these infinite loops and the ensuing memory leaks, the lifecycle of each goroutine is strictly controlled via the context package. The implementation retains the cancellation function (CancelFunc) of each process in memory. Thus, if a new HTTP request signals a state change on a block already undergoing calculation, the code explicitly calls the cancellation function of the old loop before instantiating a new one with updated parameters.

Within this evaluation loop, the code must impose a minimum delay between setpoint changes directed at the physical stations. The use of the blocking time.Sleep() function was prohibited, as it would pause the entire calculation process for the block. Instead, an in-memory caching system records the timestamp of the last transmission for each station. At each iteration, the time.Since() condition evaluates the elapsed time against this cache. If the minimum delay is not met, the continue keyword is executed, allowing the program to ignore the relevant station while immediately continuing the evaluation of other transactions within the same block.

Finally, the effective application of the calculated mathematical limits requires sending network requests (HTTP POST) to the chargers. To avoid penalizing the execution time of the main loop, the updateTransactionLimitInDB function is called asynchronously using the go keyword. This approach delegates the processing of network I/O to parallel ephemeral subroutines, thereby maximizing the performance of the calculation engine. The detailed Smart Charging algorithm is available in @appendix-d.

=== Alerting System (notification-service)

The implementation of the alerting service relies on processing the various data received on the endpoints, and the technical dispatch of emails. The sending of electronic messages relies entirely on Go's standard net/smtp library.

When a logical process is triggered by an incoming HTTP request, the Go code formulates an event-context-specific GraphQL query to traverse the table hierarchy and extract target email addresses. The SMTP module then formats the header, body, and metadata of the email, and opens a network connection to the mail server configured by the school. This modular implementation choice using the standard SMTP port allowed the component to adapt without any software modification to the network constraints of the Linux server, making the microservice operational as soon as the infrastructure's network rights were granted.

== Deployment and CI/CD Pipeline

The continuous integration of the project relies on the use of GitHub Actions, ensuring smooth automation of the development cycle. A Git workflow was specifically configured to react to every new modification pushed to the code repository. To optimize processing times and resource usage on the integration servers, the system is capable of precisely detecting which source code directories have been modified. Since the overall architecture is split into several distinct modules, only the Docker images corresponding to the altered components are rebuilt by the automation scripts. Once compiled and generated, these new images are automatically pushed and stored in the container registry, ready for deployment.

Although the executable build phase is fully automated, the actual deployment to the production Linux server was deliberately kept as a manual process. This implementation approach maintains strict engineering control over the production release. In practice, the update is performed in a command-line environment on the target server. Executing the docker compose pull command queries the registry to retrieve the latest versions of the containerized binaries, and then docker compose up forces the runtime engine to recreate and restart the relevant services. Detailed instructions for updating the system components are documented in @appendix-a.