#import "/metadata.typ": *
#pagebreak()
= #i18n("appendix-title", lang: option.lang) <sec:appendix>
#set heading(supplement: "Appendix")


== Docker Deployment Guide and Commands
<appendix-a>

#{
  set heading(offset: 2)
  set heading(numbering: none)
  include "../main/A00-usage-guide.typ"
}

#pagebreak()
== Raw extracts from the Smart Charging logs
<appendix-b>

#show raw: set text(size: 6.7pt) 

#raw(read("../resources/smart-charging-A.txt"), block: true)
#raw(read("../resources/smart-charging-B.txt"), block: true)

#pagebreak()
== Database schema (Entity-Relationship Diagram)
<appendix-c>

#figure(
  image("../resources/img/Appendix-C_DB-table-detail.svg", width: 120%),
  caption: [Schéma de la base de données du Smart Charging]
)

#pagebreak()
== Code snippets from the Smart Charging algorithm logic
<appendix-d>

#show raw: set text(size: 6.5pt) // Taille légèrement réduite pour le code Go

#raw(read("../resources/Appendix-D_code_snippet.go"), block: true, lang: "go")

#pagebreak()
== Statement on the Use of Artificial Intelligence
<appendix-e>

#{
  set heading(offset: 2)
  set heading(numbering: none)
  include "../main/E00-IA-Detail.typ"
}

#pagebreak()
== Email Notification Example
<appendix-f>

#figure(
  image("../resources/img/appendix-F1.png", width: 100%),
  caption: [Example of an unknown badge scan notification.]
)
#figure(
  image("../resources/img/appendix-F2.png", width: 100%),
  caption: [Example of an illegal session detection.]
)
#figure(
  image("../resources/img/appendix-F3.png", width: 100%),
  caption: [Example of a suspended session due to the lack of available power.]
)



