#import "/metadata.typ": *
#pagebreak()
= Conclusion and Future Work
<sec:conclusion-perspectives>

#option-style(type:option.type)[
Contenu attendu
- *Bilan :* Rappel des objectifs initiaux et confirmation de leur atteinte (le PoC est entièrement fonctionnel).
- *Perspectives :* Plan d'action pour la suite (comment intégrer concrètement la passerelle Modbus TCP pour les chargeurs AC, l'ouverture du serveur vers l'extérieur pour les notifications, etc.).
]

== PoC Assessment

The objective of this diploma project was the design and deployment of a management and supervision platform for a fleet of electric vehicle charging stations. At the end of this work, all the mandatory objectives set by the specifications were successfully achieved. The centralized system, built around CitrineOS and the OCPP protocol, is fully functional. It ensures bidirectional communication with the chargers, real-time consumption tracking via a custom dashboard, as well as the complete management of users and their RFID access.

Beyond the fundamental requirements, the major optional objective consisting of developing a dynamic power distribution algorithm (Smart Charging) was fully designed, implemented within a dedicated microservice, and validated in a simulation environment. This algorithm specifically solved the power limitation problem mentioned in the @sec:sc-lb-soa. This Proof of Concept (PoC) demonstrates that it is technically viable to modernize the campus charging infrastructure while eliminating any dependence on a specific manufacturer.

== Challenges Encountered

The realization of this software architecture required significant upskilling in several modern technologies that had not been covered in the curriculum until then. Developing a comprehensive web interface with React, containerizing application services, and setting up continuous integration pipelines represented a steep but extremely formative learning curve.

On a technical level, configuring the simulation environment proved to be particularly complex. Deploying the five EVerest simulators posed challenges in terms of internal network routing under Docker, due to sometimes sparse documentation on these specific use cases. Furthermore, it was necessary to perform reverse engineering operations and modify the Node-RED source code of the simulators to unlock certain visual aspects of the original interface and allow the manual injection of custom NFC identifiers for the test scenarios.

== Future Work

Although functional, this platform constitutes a technical foundation that needs to be enriched before large-scale deployment. 

From a hardware perspective, the integration of the older AC stations on campus remains to be finalized. Since the OCPP 1.4 protocol of these devices is too far removed from current standards, the preferred solution will be to develop a software translation gateway controlling the stations via their Modbus TCP registers, requiring a complete mapping of hardware commands to modern OCPP requests.

Regarding the user experience, the dashboard interface will need to be adapted for mobile devices. This update will allow QR codes to be placed directly on the physical stations, offering users an instant redirection to their charging session tracking portal. In parallel, to guarantee the stability of this interface during future updates, the implementation of automated end-to-end testing must be integrated into the development process.

The network and server infrastructure also require several evolutions. Currently containerized, the overall configuration of the images must be generalized via environment variables to facilitate deployment to other sites. The continuous integration pipeline will need to be complemented by a continuous deployment system automating the updating of services in production. Regarding security, although perimeter protection is already solidly ensured by the Traefik reverse proxy, which manages TLS encryption and strict request routing, the server is now exposed to the internet. Future work should therefore focus on application security, notably through the implementation of a Web Application Firewall or intrusion detection tools to block malicious requests and brute-force attacks on the login interface.

Finally, the business logic will need to align with the institution's standards. The current account creation system is intended to be replaced by a centralized authentication communicating with the HES-SO identity servers. Depending on the school's future administrative decisions, an automated billing module could also be grafted onto the event-driven architecture already in place.