//
// Description: Main document to stitch everything together
//
#import "/metadata.typ": *
#import "/tail/bibliography.typ": *
#import "/tail/glossary.typ": *
#show:make-glossary
#register-glossary(entry-list)

//-------------------------------------
// Template config
//
#show: thesis.with(
  option: option,
  doc: doc,
  thesis-data-page: thesis-data-page,
  summary-page: summary-page,
  display: display,
  professor: professor,
  expert: expert,
  // partner: expert,
  school: school,
  date: date,
  tableof: tableof,
  logos: logos,
  fonts: fonts,
)

//-------------------------------------
// Content
//
#include "/main/01-abstract.typ"
#include "main/100-introduction.typ"
#include "main/101-SOA.typ"
#include "main/102-architecture.typ"
#include "main/103-backendImplementation.typ"
#include "main/104-frontend.typ"
#include "main/105-tests.typ"
#include "main/106-conclusions.typ"

//-------------------------------------
// Glossary
//
#make_glossary(gloss:gloss, title:i18n("gloss-title", lang: option.lang))

//-------------------------------------
// Bibliography
//
#make_bibliography(bib:bib, title:i18n("bib-title", lang: option.lang))

//-------------------------------------
// Appendix
//
#if appendix == true {[
  #counter(heading).update(0)
  #set heading(numbering:"A")
  #include "/tail/a-appendix.typ"
]}
