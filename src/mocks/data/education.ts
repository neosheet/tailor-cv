import type { SourceItem } from "../types"

/** `studyType` and `score` live in `details`; `courses` become nested lines. */
export const education: SourceItem[] = [
  {
    id: "edu-uid",
    title: "Universitas Indraprasta Digital",
    subtitle: "Computer Science",
    url: "https://uid.example.ac.id",
    startDate: "2015-08",
    endDate: "2017-07",
    details: { studyType: "Master of Computer Science", score: "3.81/4.00" },
    tags: ["postgraduate"],
    lines: {
      courses: [
        "Distributed Systems",
        "Advanced Database Systems",
        "Machine Learning Foundations",
        "Research Methods",
      ],
    },
  },
  {
    id: "edu-itn",
    title: "Institut Teknologi Nusantara",
    subtitle: "Informatics Engineering",
    url: "https://itn.example.ac.id",
    startDate: "2006-08",
    endDate: "2010-07",
    details: { studyType: "Bachelor of Engineering", score: "3.64/4.00" },
    tags: ["undergraduate"],
    lines: {
      courses: [
        "Algorithms and Data Structures",
        "Operating Systems",
        "Computer Networks",
        "Software Engineering",
        "Compiler Construction",
      ],
    },
  },
]
