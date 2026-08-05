import type { SourceItem } from "../types"

/**
 * Projects are the only kind carrying three nested lists — `highlights`, `keywords`,
 * and `roles`. Useful for exercising the "three selection controls on one entry"
 * problem flagged in the taxonomy spec.
 */
export const projects: SourceItem[] = [
  {
    id: "proj-arus",
    title: "Arus",
    summary:
      "Open-source toolkit for replaying Kafka topics into a local development " +
      "environment without a staging cluster. Around 2,300 stars.",
    url: "https://github.com/aryanugraha/arus",
    startDate: "2022-04",
    tags: ["opensource", "current"],
    lines: {
      highlights: [
        {
          content:
            "Adopted by four companies as their standard local dev workflow",
          tags: ["opensource"],
        },
        {
          content: "Replays 1M messages in under 40 seconds on a laptop",
          tags: ["performance"],
        },
        {
          content:
            "Maintained a 14-person contributor community across three years",
          tags: ["leadership", "opensource"],
        },
      ],
      keywords: ["Kafka", "Go", "CLI", "Developer tooling"],
      roles: ["Creator", "Maintainer"],
    },
    skills: ["skill-go", "skill-kafka", "skill-docker"],
  },
  {
    id: "proj-pantau",
    favorite: true,
    title: "Pantau",
    summary:
      "Self-hosted uptime and certificate monitor with a single-binary deploy, " +
      "built for teams that cannot send health data to third parties.",
    url: "https://github.com/aryanugraha/pantau",
    startDate: "2020-09",
    endDate: "2023-06",
    tags: ["opensource"],
    lines: {
      highlights: [
        {
          content:
            "Ships as one 12MB binary with an embedded UI and no dependencies",
          tags: ["backend"],
        },
        {
          content: "Handed the project to a new maintainer after three years",
          tags: ["opensource"],
        },
      ],
      keywords: ["Go", "SQLite", "Prometheus", "Self-hosted"],
      roles: ["Creator", "Former maintainer"],
    },
    skills: ["skill-go", "skill-observability"],
  },
  {
    id: "proj-lokal",
    title: "Lokal",
    summary:
      "Offline-first sync library for React applications on unreliable connections, " +
      "extracted from retail point-of-sale work.",
    url: "https://github.com/aryanugraha/lokal",
    startDate: "2019-02",
    endDate: "2021-11",
    tags: ["opensource", "frontend"],
    lines: {
      highlights: [
        {
          content: "Conflict resolution survives multi-day offline periods",
          tags: ["frontend", "reliability"],
        },
        {
          content: "Written up in two Indonesian developer newsletters",
          tags: ["communication"],
        },
      ],
      keywords: ["React", "IndexedDB", "CRDT", "Offline-first"],
      roles: ["Creator"],
    },
    skills: ["skill-typescript", "skill-react"],
  },
  {
    id: "proj-jadwal",
    title: "Jadwal",
    summary:
      "Small library for parsing and rendering Indonesian public holiday calendars, " +
      "including the movable Islamic dates that most libraries get wrong.",
    url: "https://github.com/aryanugraha/jadwal",
    startDate: "2018-05",
    endDate: "2019-01",
    tags: ["opensource"],
    lines: {
      highlights: [
        {
          content: "Used by six local HR and payroll products",
          tags: ["opensource"],
        },
      ],
      keywords: ["TypeScript", "Calendars", "Localisation"],
      roles: ["Creator"],
    },
    skills: ["skill-typescript"],
  },
]
