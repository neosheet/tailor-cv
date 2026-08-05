import type { SourceItem } from "../types"

/**
 * The remaining pools. Volunteer carries responsibilities and highlights like Work;
 * Interests carry keywords; Awards, Certificates, Publications, Languages, and
 * References are flat — a CV can only pick whole entries.
 */

export const volunteer: SourceItem[] = [
  {
    id: "vol-kodekita",
    title: "KodeKita",
    subtitle: "Volunteer Instructor",
    url: "https://kodekita.example.org",
    startDate: "2019-01",
    summary:
      "Weekend programming classes for high-school students in underserved districts " +
      "around Greater Jakarta.",
    tags: ["current", "teaching"],
    lines: {
      responsibilities: [
        {
          content: "Teach a 12-week introductory web development course",
          tags: ["teaching"],
        },
        {
          content: "Maintain the curriculum and its Bahasa Indonesia materials",
          tags: ["teaching"],
        },
      ],
      highlights: [
        {
          content:
            "Taught 240+ students, with 31 going on to study computing at university",
          tags: ["teaching", "leadership"],
        },
        {
          content: "Translated the full curriculum into Bahasa Indonesia",
          tags: ["teaching"],
        },
      ],
    },
  },
  {
    id: "vol-banjir",
    title: "Peta Banjir Jakarta",
    subtitle: "Backend Contributor",
    startDate: "2020-01",
    endDate: "2021-04",
    summary:
      "Volunteer-run flood reporting map used during Jakarta's monsoon seasons.",
    tags: ["civictech"],
    lines: {
      responsibilities: [
        { content: "Maintained the report ingestion API", tags: ["backend"] },
      ],
      highlights: [
        {
          content:
            "Kept the service up through a peak of 90,000 reports in 48 hours",
          tags: ["reliability", "backend"],
        },
      ],
    },
  },
]

export const awards: SourceItem[] = [
  {
    id: "award-engineering-excellence",
    title: "Engineering Excellence Award",
    subtitle: "Nusantara Pay",
    startDate: "2022-11",
    summary: "Company-wide award for the settlement pipeline rebuild.",
    tags: ["recognition"],
  },
  {
    id: "award-hackathon",
    title: "First Place, Fintech Hackathon Jakarta",
    subtitle: "Asosiasi Fintech Indonesia",
    startDate: "2018-09",
    summary:
      "Won with a QR-based micro-lending prototype for informal market traders.",
    tags: ["recognition"],
  },
]

export const certificates: SourceItem[] = [
  {
    id: "cert-cka",
    title: "Certified Kubernetes Administrator",
    subtitle: "Cloud Native Computing Foundation",
    url: "https://training.linuxfoundation.org",
    startDate: "2022-06",
    tags: ["infrastructure"],
  },
  {
    id: "cert-aws-sa",
    title: "AWS Certified Solutions Architect – Professional",
    subtitle: "Amazon Web Services",
    url: "https://aws.amazon.com/certification",
    startDate: "2021-03",
    tags: ["infrastructure"],
  },
  {
    id: "cert-postgres",
    title: "PostgreSQL 14 Associate Certification",
    subtitle: "EDB",
    startDate: "2023-02",
    tags: ["database"],
  },
]

export const publications: SourceItem[] = [
  {
    id: "pub-ledger",
    title: "Designing an Idempotent Ledger for High-Volume Payments",
    subtitle: "InfoQ",
    url: "https://infoq.example.com/articles/idempotent-ledger",
    startDate: "2023-01",
    summary:
      "Long-form write-up of the double-entry ledger and idempotency design used " +
      "at Nusantara Pay.",
    tags: ["writing", "payments"],
  },
  {
    id: "pub-search",
    title: "Tuning Elasticsearch Relevance for Bahasa Indonesia",
    subtitle: "Kirana Engineering Blog",
    url: "https://engineering.kiranacommerce.example.com/bahasa-relevance",
    startDate: "2020-08",
    summary:
      "How stemming and compound-word handling changed marketplace search results.",
    tags: ["writing", "data"],
  },
]

export const languages: SourceItem[] = [
  {
    id: "lang-id",
    title: "Indonesian",
    subtitle: "Native speaker",
    tags: ["language"],
  },
  {
    id: "lang-en",
    title: "English",
    subtitle: "Full professional proficiency",
    tags: ["language"],
  },
  {
    id: "lang-ja",
    title: "Japanese",
    subtitle: "Elementary (JLPT N4)",
    tags: ["language"],
  },
]

export const interests: SourceItem[] = [
  {
    id: "int-cycling",
    title: "Long-distance cycling",
    tags: ["personal"],
    lines: { keywords: ["Audax", "Bikepacking", "Java coast routes"] },
  },
  {
    id: "int-coffee",
    title: "Specialty coffee",
    tags: ["personal"],
    lines: { keywords: ["Filter brewing", "Indonesian single origins"] },
  },
  {
    id: "int-mechanical-keyboards",
    title: "Mechanical keyboards",
    tags: ["personal"],
    lines: { keywords: ["Custom firmware", "Keycap design"] },
  },
]

export const references: SourceItem[] = [
  {
    id: "ref-siti",
    title: "Siti Rahmawati",
    summary:
      "Arya rebuilt our settlement pipeline while it was carrying live traffic, and " +
      "did it without a single customer-visible incident. He is the engineer I " +
      "trust with the systems I cannot afford to break.",
    subtitle: "VP Engineering, Nusantara Pay",
    tags: ["reference"],
  },
  {
    id: "ref-daniel",
    title: "Daniel Tanuwijaya",
    summary:
      "The clearest technical writer I have worked with. Arya's RFCs routinely " +
      "settled arguments that had been circling for weeks.",
    subtitle: "Director of Platform, Lumbung Labs",
    tags: ["reference"],
  },
]
