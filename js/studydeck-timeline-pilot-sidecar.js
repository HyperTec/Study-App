// Auto-generated pilot timeline sidecar bridge for the file-open StudyDeck app.
(function(){
  window.STUDYDECK_TIMELINE_SIDECARS = window.STUDYDECK_TIMELINE_SIDECARS || [];
  window.STUDYDECK_TIMELINE_SIDECARS.push({
  "schemaVersion": 1,
  "sidecarType": "studydeck-timeline",
  "title": "Timeline & Attribution Timeline Sidecar v1 Pilot",
  "deckName": "Biblical Timeline and Attribution",
  "sourceDeckName": "Biblical Timeline and Attribution",
  "deckCategory": "timeline-attribution",
  "createdForDeckUidPolicy": "cardUid",
  "description": "Pilot timeline sidecar for testing timeline display with a small set of New Testament writings and historical anchors.",
  "source": {
    "deckFile": "Biblical_Timeline_and_Attribution_batch48_notes_refined.json",
    "deckFileModified": "2026-04-12T22:48:35-0700",
    "deckFileSha256": "a109b480287f8ce48075e45dc47d4da535318b07a5a94e6cdd18552a0948f21f",
    "cardsScanned": 275,
    "pilotCards": 35
  },
  "timelineLearning": {
    "yearScale": {
      "negativeYears": "BCE",
      "positiveYears": "CE",
      "displayRule": "Numeric years are timeline coordinates. Display labels should be shown to learners, especially when dates are approximate or debated."
    },
    "timelines": {
      "nt_context_pilot_v1": {
        "title": "Timeline & Attribution Pilot",
        "description": "A one-timeline pilot grouping writings, people, rulers, and events into the full-deck category set.",
        "minYear": -250,
        "maxYear": 180,
        "defaultEra": "CE",
        "lanes": [
          {
            "id": "history-events",
            "label": "History and Events",
            "color": "#d97706"
          },
          {
            "id": "rulers-public-figures",
            "label": "Rulers and Public Figures",
            "color": "#9b5f34"
          },
          {
            "id": "people-communities",
            "label": "People and Communities",
            "color": "#2f7774"
          },
          {
            "id": "texts-attribution",
            "label": "Texts and Attribution",
            "color": "#5267b8"
          },
          {
            "id": "transmission-reception",
            "label": "Transmission and Reception",
            "color": "#5f7a3a"
          }
        ],
        "contextEvents": [
          {
            "id": "jewish_war",
            "label": "Jewish War",
            "startYear": 66,
            "endYear": 73,
            "displayDate": "66-73 CE",
            "dateType": "historical_range",
            "lane": "history-events",
            "shortNote": "A major Jewish revolt against Roman rule in Judea that ended with Rome destroying Jerusalem and the Second Temple.",
            "category": "History and Events"
          },
          {
            "id": "temple_destroyed",
            "label": "Temple destroyed",
            "startYear": 70,
            "endYear": 70,
            "displayDate": "70 CE",
            "dateType": "single_year",
            "lane": "history-events",
            "shortNote": "Roman forces destroyed the Second Temple in Jerusalem, a central place of Jewish worship.",
            "category": "History and Events"
          }
        ],
        "visualHints": {
          "singleYearStyle": "dot",
          "rangeStyle": "bar",
          "uncertainRangeStyle": "soft_bar",
          "showContextEventsByDefault": true
        }
      }
    }
  },
  "cards": {
    "BTGD": {
      "cardUid": "BTGD",
      "titleHint": "Herod the Great",
      "timeline": {
        "eventId": "BTGD_herod_the_great",
        "timelineId": "nt_context_pilot_v1",
        "label": "Herod the Great",
        "startYear": -37,
        "endYear": -4,
        "sortYear": -37,
        "displayDate": "37-4 BCE",
        "dateType": "regnal_range",
        "lane": "rulers-public-figures",
        "category": "Rulers and Public Figures",
        "confidence": "strong historical anchor",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Ruler connected with Matthew's nativity chronology and late Second Temple politics."
      }
    },
    "BTGH": {
      "cardUid": "BTGH",
      "titleHint": "Augustus",
      "timeline": {
        "eventId": "BTGH_augustus",
        "timelineId": "nt_context_pilot_v1",
        "label": "Augustus",
        "startYear": -27,
        "endYear": 14,
        "sortYear": -27,
        "displayDate": "27 BCE-14 CE",
        "dateType": "regnal_range",
        "lane": "rulers-public-figures",
        "category": "Rulers and Public Figures",
        "confidence": "strong historical anchor",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Imperial setting used by Luke's nativity framework."
      }
    },
    "BTGJ": {
      "cardUid": "BTGJ",
      "titleHint": "Herod Antipas",
      "timeline": {
        "eventId": "BTGJ_herod_antipas",
        "timelineId": "nt_context_pilot_v1",
        "label": "Herod Antipas",
        "startYear": -4,
        "endYear": 39,
        "sortYear": -4,
        "displayDate": "4 BCE-39 CE",
        "dateType": "regnal_range",
        "lane": "rulers-public-figures",
        "category": "Rulers and Public Figures",
        "confidence": "strong historical anchor",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Ruler connected with John the Baptist and Jesus traditions."
      }
    },
    "BTGI": {
      "cardUid": "BTGI",
      "titleHint": "Tiberius",
      "timeline": {
        "eventId": "BTGI_tiberius",
        "timelineId": "nt_context_pilot_v1",
        "label": "Tiberius",
        "startYear": 14,
        "endYear": 37,
        "sortYear": 14,
        "displayDate": "14-37 CE",
        "dateType": "regnal_range",
        "lane": "rulers-public-figures",
        "category": "Rulers and Public Figures",
        "confidence": "strong historical anchor",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Important for Luke's dating of John the Baptist's ministry."
      }
    },
    "BTGK": {
      "cardUid": "BTGK",
      "titleHint": "Caiaphas",
      "timeline": {
        "eventId": "BTGK_caiaphas",
        "timelineId": "nt_context_pilot_v1",
        "label": "Caiaphas",
        "startYear": 18,
        "endYear": 36,
        "sortYear": 18,
        "displayDate": "c. 18-36 CE",
        "dateType": "approximate_office_range",
        "lane": "rulers-public-figures",
        "category": "Rulers and Public Figures",
        "confidence": "common historical range",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "High-priestly setting for passion narrative traditions."
      }
    },
    "BTGE": {
      "cardUid": "BTGE",
      "titleHint": "Pontius Pilate",
      "timeline": {
        "eventId": "BTGE_pontius_pilate",
        "timelineId": "nt_context_pilot_v1",
        "label": "Pontius Pilate",
        "startYear": 26,
        "endYear": 37,
        "sortYear": 26,
        "displayDate": "26-36/37 CE",
        "dateType": "office_range",
        "lane": "rulers-public-figures",
        "category": "Rulers and Public Figures",
        "confidence": "strong historical anchor",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Roman governor used as a major anchor for Jesus's execution."
      }
    },
    "BTHP": {
      "cardUid": "BTHP",
      "titleHint": "John the Baptist",
      "timeline": {
        "eventId": "BTHP_john_the_baptist",
        "timelineId": "nt_context_pilot_v1",
        "label": "John the Baptist",
        "startYear": 27,
        "endYear": 30,
        "sortYear": 27,
        "displayDate": "early 1st century CE",
        "dateType": "approximate_activity_range",
        "lane": "people-communities",
        "category": "People and Communities",
        "confidence": "approximate historical placement",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "A key anchor for the beginning of Jesus's public ministry."
      }
    },
    "BTHQ": {
      "cardUid": "BTHQ",
      "titleHint": "Jesus of Nazareth",
      "timeline": {
        "eventId": "BTHQ_jesus_of_nazareth",
        "timelineId": "nt_context_pilot_v1",
        "label": "Jesus of Nazareth",
        "startYear": 27,
        "endYear": 30,
        "sortYear": 27,
        "displayDate": "public activity c. 27-30 CE",
        "dateType": "approximate_activity_range",
        "lane": "people-communities",
        "category": "People and Communities",
        "confidence": "approximate historical placement",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Placed with John the Baptist, Pilate, and Herodian rulers."
      }
    },
    "BTCA": {
      "cardUid": "BTCA",
      "titleHint": "1 Thessalonians",
      "timeline": {
        "eventId": "BTCA_1_thessalonians",
        "timelineId": "nt_context_pilot_v1",
        "label": "1 Thessalonians",
        "startYear": 50,
        "endYear": 52,
        "sortYear": 50,
        "displayDate": "early 50s CE",
        "dateType": "approximate_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "common critical range",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "One of Paul's earliest surviving letters."
      }
    },
    "BTAH": {
      "cardUid": "BTAH",
      "titleHint": "Pauline letters",
      "timeline": {
        "eventId": "BTAH_pauline_letters",
        "timelineId": "nt_context_pilot_v1",
        "label": "Undisputed Pauline letters",
        "startYear": 50,
        "endYear": 64,
        "sortYear": 50,
        "displayDate": "50s-early 60s CE",
        "dateType": "collection_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "common critical range",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Earliest surviving Christian writings from a known historical author."
      }
    },
    "BTCY": {
      "cardUid": "BTCY",
      "titleHint": "1 Corinthians",
      "timeline": {
        "eventId": "BTCY_1_corinthians",
        "timelineId": "nt_context_pilot_v1",
        "label": "1 Corinthians",
        "startYear": 53,
        "endYear": 55,
        "sortYear": 53,
        "displayDate": "50s CE",
        "dateType": "approximate_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "common critical range",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Important early discussion of resurrection, community practice, and Jesus tradition."
      }
    },
    "BTCZ": {
      "cardUid": "BTCZ",
      "titleHint": "2 Corinthians",
      "timeline": {
        "eventId": "BTCZ_2_corinthians",
        "timelineId": "nt_context_pilot_v1",
        "label": "2 Corinthians",
        "startYear": 55,
        "endYear": 57,
        "sortYear": 55,
        "displayDate": "50s CE",
        "dateType": "approximate_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "common critical range",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Reflects conflict and reconciliation in Paul's dealings with Corinth."
      }
    },
    "BTCB": {
      "cardUid": "BTCB",
      "titleHint": "Philemon",
      "timeline": {
        "eventId": "BTCB_philemon",
        "timelineId": "nt_context_pilot_v1",
        "label": "Philemon",
        "startYear": 55,
        "endYear": 62,
        "sortYear": 55,
        "displayDate": "50s or early 60s CE",
        "dateType": "approximate_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "common critical range",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "A personal Pauline letter tied to a named historical individual."
      }
    },
    "BTCC": {
      "cardUid": "BTCC",
      "titleHint": "Romans",
      "timeline": {
        "eventId": "BTCC_romans",
        "timelineId": "nt_context_pilot_v1",
        "label": "Romans",
        "startYear": 56,
        "endYear": 58,
        "sortYear": 56,
        "displayDate": "mid- to late 50s CE",
        "dateType": "approximate_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "common critical range",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "A major anchor for Paul's theology and chronology."
      }
    },
    "BTGF": {
      "cardUid": "BTGF",
      "titleHint": "Nero",
      "timeline": {
        "eventId": "BTGF_nero",
        "timelineId": "nt_context_pilot_v1",
        "label": "Nero",
        "startYear": 54,
        "endYear": 68,
        "sortYear": 54,
        "displayDate": "54-68 CE",
        "dateType": "regnal_range",
        "lane": "rulers-public-figures",
        "category": "Rulers and Public Figures",
        "confidence": "strong historical anchor",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Likely imperial context for the last phase of Paul's life."
      }
    },
    "BTAE": {
      "cardUid": "BTAE",
      "titleHint": "Colossians",
      "timeline": {
        "eventId": "BTAE_colossians",
        "timelineId": "nt_context_pilot_v1",
        "label": "Colossians",
        "startYear": 60,
        "endYear": 90,
        "sortYear": 60,
        "displayDate": "60s CE if Pauline, later if pseudonymous",
        "dateType": "debated_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "authorship-dependent",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "A disputed Pauline letter, so its placement depends on the authorship judgment."
      }
    },
    "BTA5": {
      "cardUid": "BTA5",
      "titleHint": "Hebrews",
      "timeline": {
        "eventId": "BTA5_hebrews",
        "timelineId": "nt_context_pilot_v1",
        "label": "Hebrews",
        "startYear": 60,
        "endYear": 90,
        "sortYear": 60,
        "displayDate": "about 60-90 CE",
        "dateType": "approximate_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "common critical range",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Anonymous writing with a debated authorship history."
      }
    },
    "BTA3": {
      "cardUid": "BTA3",
      "titleHint": "Mark",
      "timeline": {
        "eventId": "BTA3_mark",
        "timelineId": "nt_context_pilot_v1",
        "label": "Mark",
        "startYear": 70,
        "endYear": 75,
        "sortYear": 70,
        "displayDate": "c. 70 CE or shortly after",
        "dateType": "approximate_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "common critical range",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Usually treated as the earliest canonical Gospel in standard critical chronology."
      }
    },
    "BTAT": {
      "cardUid": "BTAT",
      "titleHint": "1 Peter",
      "timeline": {
        "eventId": "BTAT_1_peter",
        "timelineId": "nt_context_pilot_v1",
        "label": "1 Peter",
        "startYear": 70,
        "endYear": 90,
        "sortYear": 70,
        "displayDate": "c. 70-90 CE",
        "dateType": "approximate_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "common critical range with authorship debate",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Often judged more plausible as Petrine-linked than 2 Peter, but still disputed."
      }
    },
    "BTED": {
      "cardUid": "BTED",
      "titleHint": "Matthew",
      "timeline": {
        "eventId": "BTED_matthew",
        "timelineId": "nt_context_pilot_v1",
        "label": "Matthew",
        "startYear": 80,
        "endYear": 90,
        "sortYear": 80,
        "displayDate": "c. 80-90 CE",
        "dateType": "approximate_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "common critical range",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Usually treated as later than Mark in standard Synoptic scholarship."
      }
    },
    "BTEE": {
      "cardUid": "BTEE",
      "titleHint": "Luke",
      "timeline": {
        "eventId": "BTEE_luke",
        "timelineId": "nt_context_pilot_v1",
        "label": "Luke",
        "startYear": 80,
        "endYear": 90,
        "sortYear": 80,
        "displayDate": "c. 80-90 CE",
        "dateType": "approximate_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "common critical range",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Usually treated as later than Mark and closely tied to Acts."
      }
    },
    "BTAQ": {
      "cardUid": "BTAQ",
      "titleHint": "Acts",
      "timeline": {
        "eventId": "BTAQ_acts",
        "timelineId": "nt_context_pilot_v1",
        "label": "Acts",
        "startYear": 80,
        "endYear": 90,
        "sortYear": 80,
        "displayDate": "c. 80-90 CE",
        "dateType": "approximate_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "common critical range",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Usually read as the second volume of Luke-Acts."
      }
    },
    "BTDW": {
      "cardUid": "BTDW",
      "titleHint": "Ephesians",
      "timeline": {
        "eventId": "BTDW_ephesians",
        "timelineId": "nt_context_pilot_v1",
        "label": "Ephesians",
        "startYear": 80,
        "endYear": 100,
        "sortYear": 80,
        "displayDate": "late 1st century CE if pseudonymous",
        "dateType": "debated_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "authorship-dependent",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Often treated as deutero-Pauline in critical scholarship."
      }
    },
    "BTGG": {
      "cardUid": "BTGG",
      "titleHint": "Domitian",
      "timeline": {
        "eventId": "BTGG_domitian",
        "timelineId": "nt_context_pilot_v1",
        "label": "Domitian",
        "startYear": 81,
        "endYear": 96,
        "sortYear": 81,
        "displayDate": "81-96 CE",
        "dateType": "regnal_range",
        "lane": "rulers-public-figures",
        "category": "Rulers and Public Figures",
        "confidence": "strong historical anchor",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Commonly cited as the imperial backdrop for Revelation."
      }
    },
    "BTAF": {
      "cardUid": "BTAF",
      "titleHint": "Revelation",
      "timeline": {
        "eventId": "BTAF_revelation",
        "timelineId": "nt_context_pilot_v1",
        "label": "Revelation",
        "startYear": 90,
        "endYear": 96,
        "sortYear": 90,
        "displayDate": "90s CE",
        "dateType": "approximate_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "common critical range",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Often linked with the reign of Domitian."
      }
    },
    "BTA8": {
      "cardUid": "BTA8",
      "titleHint": "John",
      "timeline": {
        "eventId": "BTA8_john",
        "timelineId": "nt_context_pilot_v1",
        "label": "John",
        "startYear": 90,
        "endYear": 100,
        "sortYear": 90,
        "displayDate": "c. 90-100 CE",
        "dateType": "approximate_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "common critical range",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Usually dated later than the Synoptic Gospels."
      }
    },
    "BTBD": {
      "cardUid": "BTBD",
      "titleHint": "Johannine writings",
      "timeline": {
        "eventId": "BTBD_johannine_writings",
        "timelineId": "nt_context_pilot_v1",
        "label": "Johannine writings",
        "startYear": 90,
        "endYear": 110,
        "sortYear": 90,
        "displayDate": "late 1st century CE and nearby",
        "dateType": "collection_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "broad critical placement",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Usually discussed as a tradition, school, or community rather than one simple author."
      }
    },
    "BTER": {
      "cardUid": "BTER",
      "titleHint": "1 Timothy",
      "timeline": {
        "eventId": "BTER_1_timothy",
        "timelineId": "nt_context_pilot_v1",
        "label": "1 Timothy",
        "startYear": 90,
        "endYear": 120,
        "sortYear": 90,
        "displayDate": "late 1st or early 2nd century CE",
        "dateType": "debated_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "common critical range if pseudonymous",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "A Pastoral Epistle often treated as pseudonymous."
      }
    },
    "BTBA": {
      "cardUid": "BTBA",
      "titleHint": "Pastoral Epistles",
      "timeline": {
        "eventId": "BTBA_pastoral_epistles",
        "timelineId": "nt_context_pilot_v1",
        "label": "Pastoral Epistles",
        "startYear": 90,
        "endYear": 120,
        "sortYear": 90,
        "displayDate": "late 1st or early 2nd century CE",
        "dateType": "collection_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "common critical range",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Usually treated as later than the undisputed Pauline letters."
      }
    },
    "BTA6": {
      "cardUid": "BTA6",
      "titleHint": "2 Peter",
      "timeline": {
        "eventId": "BTA6_2_peter",
        "timelineId": "nt_context_pilot_v1",
        "label": "2 Peter",
        "startYear": 90,
        "endYear": 130,
        "sortYear": 90,
        "displayDate": "late 1st or early 2nd century CE",
        "dateType": "debated_range",
        "lane": "texts-attribution",
        "category": "Texts and Attribution",
        "confidence": "broad critical placement",
        "sourceCardNoteLabel": "Timeline / Attribution",
        "shortNote": "Often treated as pseudonymous and later than Peter's lifetime."
      }
    },
    "BTHB": {
      "cardUid": "BTHB",
      "titleHint": "Septuagint",
      "timeline": {
        "eventId": "BTHB_septuagint",
        "timelineId": "nt_context_pilot_v1",
        "label": "Septuagint",
        "startYear": -250,
        "endYear": -100,
        "sortYear": -250,
        "displayDate": "3rd-2nd century BCE",
        "dateType": "translation_tradition_range",
        "lane": "transmission-reception",
        "category": "Transmission and Reception",
        "confidence": "broad scholarly range",
        "sourceCardNoteLabel": "Timeline / Reception",
        "shortNote": "Greek translation tradition that shaped the scriptural world used by many New Testament authors."
      }
    },
    "BTHC": {
      "cardUid": "BTHC",
      "titleHint": "Dead Sea Scrolls",
      "timeline": {
        "eventId": "BTHC_dead_sea_scrolls",
        "timelineId": "nt_context_pilot_v1",
        "label": "Dead Sea Scrolls",
        "startYear": -250,
        "endYear": 68,
        "sortYear": -250,
        "displayDate": "c. 250 BCE-68 CE",
        "dateType": "manuscript_corpus_range",
        "lane": "transmission-reception",
        "category": "Transmission and Reception",
        "confidence": "manuscript tradition anchor",
        "sourceCardNoteLabel": "Timeline / Reception",
        "shortNote": "Qumran-area manuscripts preserve earlier biblical forms and show textual diversity before later standardization."
      }
    },
    "BTHD": {
      "cardUid": "BTHD",
      "titleHint": "Papias",
      "timeline": {
        "eventId": "BTHD_papias",
        "timelineId": "nt_context_pilot_v1",
        "label": "Papias",
        "startYear": 110,
        "endYear": 130,
        "sortYear": 110,
        "displayDate": "early 2nd century CE",
        "dateType": "reception_tradition_range",
        "lane": "transmission-reception",
        "category": "Transmission and Reception",
        "confidence": "early reception witness",
        "sourceCardNoteLabel": "Timeline / Reception",
        "shortNote": "Early Christian writer tied to later traditions about Mark and Matthew."
      }
    },
    "BTII": {
      "cardUid": "BTII",
      "titleHint": "Rylands Papyrus P52",
      "timeline": {
        "eventId": "BTII_rylands_papyrus_p52",
        "timelineId": "nt_context_pilot_v1",
        "label": "Rylands Papyrus P52",
        "startYear": 125,
        "endYear": 175,
        "sortYear": 125,
        "displayDate": "2nd century CE",
        "dateType": "manuscript_witness_range",
        "lane": "transmission-reception",
        "category": "Transmission and Reception",
        "confidence": "early manuscript witness",
        "sourceCardNoteLabel": "Timeline / Reception",
        "shortNote": "Small John fragment showing the Gospel circulated by the 2nd century."
      }
    },
    "BTMC": {
      "cardUid": "BTMC",
      "titleHint": "Martyrdom of Polycarp",
      "timeline": {
        "eventId": "BTMC_martyrdom_of_polycarp",
        "timelineId": "nt_context_pilot_v1",
        "label": "Martyrdom of Polycarp",
        "startYear": 155,
        "endYear": 170,
        "sortYear": 155,
        "displayDate": "mid-late 2nd century CE",
        "dateType": "reception_text_range",
        "lane": "transmission-reception",
        "category": "Transmission and Reception",
        "confidence": "early reception witness",
        "sourceCardNoteLabel": "Timeline / Reception",
        "shortNote": "Early martyrdom account showing respected Christian literature circulating beyond the later New Testament canon."
      }
    }
  },
  "totals": {
    "timelines": 1,
    "contextEvents": 2,
    "cards": 35,
    "timelineEvents": 35
  },
  "authoringReview": {
    "status": "pilot",
    "needsHumanReviewBeforeFullDeckExpansion": true,
    "notes": [
      "This sidecar is meant to test the timeline feature before the full Timeline & Attribution deck is converted.",
      "Display labels are the learner-facing dates; numeric years are only for drawing and sorting.",
      "Debated authorship cards intentionally use wider ranges instead of pretending the dates are exact.",
      "Pilot lanes now use the selected one-timeline 5-category map: History and Events, Rulers and Public Figures, People and Communities, Texts and Attribution, and Transmission and Reception.",
      "Transmission and Reception now has a five-item starter set: Septuagint, Dead Sea Scrolls, Papias, Rylands Papyrus P52, and Martyrdom of Polycarp."
    ],
    "recommendedNextCards": [
      "BTFC",
      "BTFD",
      "BTFI",
      "BTFJ",
      "BTFK",
      "BTFL",
      "BTFP",
      "BTFQ"
    ]
  }
});
})();
