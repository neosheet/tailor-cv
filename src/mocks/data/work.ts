import type { SourceItem } from "../types"

/**
 * Ten roles across ~14 years, newest first.
 *
 * Bullets are deliberately over-supplied and heavily tagged — the point of the demo
 * is that no single CV should carry all of them. Filtering `leadership` versus
 * `backend` should produce visibly different résumés from the same rows.
 */
export const work: SourceItem[] = [
  {
    id: "work-lumbung",
    details: {
      employmentType: "full-time",
      workplaceType: "hybrid",
      location: "Jakarta, ID",
    },
    title: "Lumbung Labs",
    subtitle: "Principal Engineer",
    url: "https://lumbunglabs.example.com",
    startDate: "2023-03",
    summary:
      "Technical direction for the data platform group: four teams, roughly thirty " +
      "engineers, serving internal analytics and a customer-facing reporting product.",
    tags: ["current", "platform"],
    lines: {
      responsibilities: [
        {
          content:
            "Set technical direction for the data platform group across four teams",
          tags: ["leadership", "architecture"],
        },
        {
          content:
            "Chair the architecture review board and own the RFC process end to end",
          tags: ["leadership", "architecture"],
        },
        {
          content:
            "Mentor five staff and senior engineers through promotion cycles",
          tags: ["leadership", "mentoring"],
        },
        {
          content: "Run the platform on-call rotation and quarterly game days",
          tags: ["reliability", "oncall"],
        },
      ],
      highlights: [
        {
          content:
            "Cut warehouse spend 41% ($780k/year) by redesigning the ingestion " +
            "tier around incremental materialisation",
          tags: ["cost", "data", "performance"],
        },
        {
          content:
            "Took platform p99 query latency from 4.2s to 620ms without adding hardware",
          tags: ["performance", "backend"],
        },
        {
          content:
            "Grew the group from 18 to 31 engineers while keeping attrition under 6%",
          tags: ["leadership", "hiring"],
        },
        {
          content:
            "Published the internal RFC template now used by every engineering group",
          tags: ["leadership", "architecture"],
        },
      ],
    },
    skills: [
      "skill-go",
      "skill-kafka",
      "skill-postgres",
      "skill-kubernetes",
      "skill-terraform",
      "skill-observability",
    ],
  },
  {
    id: "work-nusantara",
    favorite: true,
    details: {
      employmentType: "full-time",
      workplaceType: "hybrid",
      location: "Jakarta, ID",
    },
    title: "Nusantara Pay",
    subtitle: "Staff Backend Engineer",
    url: "https://nusantarapay.example.com",
    startDate: "2021-01",
    endDate: "2023-02",
    summary:
      "Ledger and settlement systems for a payments processor handling roughly 2.4 " +
      "million transactions a day across six banking partners.",
    tags: ["payments", "backend"],
    lines: {
      responsibilities: [
        {
          content:
            "Owned the double-entry ledger and daily settlement pipeline",
          tags: ["backend", "payments"],
        },
        {
          content:
            "Led the migration from a Rails monolith to seven Go services",
          tags: ["migration", "architecture"],
        },
        {
          content:
            "Partnered with compliance on audit trails for Bank Indonesia reporting",
          tags: ["compliance", "payments"],
        },
        {
          content: "Reviewed every change touching money movement",
          tags: ["backend", "reliability"],
        },
      ],
      highlights: [
        {
          content:
            "Rebuilt settlement to run in 11 minutes, down from 3.5 hours, " +
            "eliminating the nightly maintenance window",
          tags: ["performance", "payments"],
        },
        {
          content:
            "Designed an idempotency layer that removed double-charge incidents entirely",
          tags: ["reliability", "payments", "backend"],
        },
        {
          content:
            "Cut ledger reconciliation discrepancies from ~40/day to under 2/week",
          tags: ["reliability", "payments"],
        },
        {
          content: "Wrote the migration playbook adopted by three other teams",
          tags: ["migration", "mentoring"],
        },
      ],
    },
    skills: [
      "skill-go",
      "skill-postgres",
      "skill-kafka",
      "skill-grpc",
      "skill-redis",
      "skill-observability",
    ],
  },
  {
    id: "work-kirana-senior",
    details: {
      employmentType: "full-time",
      workplaceType: "on-site",
      location: "Jakarta, ID",
    },
    title: "Kirana Commerce",
    subtitle: "Senior Backend Engineer",
    url: "https://kiranacommerce.example.com",
    startDate: "2019-04",
    endDate: "2020-12",
    summary:
      "Search, catalogue, and checkout for a marketplace with 9 million SKUs and a " +
      "peak of 40,000 concurrent shoppers during flash sales.",
    tags: ["commerce", "backend"],
    lines: {
      responsibilities: [
        {
          content: "Owned catalogue search and the checkout service",
          tags: ["backend", "commerce"],
        },
        {
          content: "Ran capacity planning for quarterly flash-sale events",
          tags: ["reliability", "performance"],
        },
        {
          content: "Mentored three junior engineers joining from bootcamps",
          tags: ["mentoring", "leadership"],
        },
      ],
      highlights: [
        {
          content:
            "Held 100% checkout availability through a flash sale at 12x normal load",
          tags: ["reliability", "performance", "commerce"],
        },
        {
          content:
            "Raised search relevance CTR 23% by reworking the Elasticsearch " +
            "analyser chain for Bahasa Indonesia",
          tags: ["data", "commerce"],
        },
        {
          content:
            "Halved catalogue index build time by moving to partial reindexing",
          tags: ["performance", "data"],
        },
      ],
    },
    skills: [
      "skill-nodejs",
      "skill-typescript",
      "skill-elasticsearch",
      "skill-redis",
      "skill-postgres",
      "skill-docker",
    ],
  },
  {
    id: "work-kirana",
    details: {
      employmentType: "full-time",
      workplaceType: "on-site",
      location: "Jakarta, ID",
    },
    title: "Kirana Commerce",
    subtitle: "Backend Engineer",
    url: "https://kiranacommerce.example.com",
    startDate: "2017-08",
    endDate: "2019-03",
    summary:
      "Order management and merchant tooling during the marketplace's growth from " +
      "800 to 14,000 active sellers.",
    tags: ["commerce", "backend"],
    lines: {
      responsibilities: [
        {
          content: "Built and maintained the order management service",
          tags: ["backend", "commerce"],
        },
        {
          content: "Shipped the merchant self-service onboarding flow",
          tags: ["backend", "commerce"],
        },
        {
          content: "Shared the weekly on-call rotation",
          tags: ["oncall", "reliability"],
        },
      ],
      highlights: [
        {
          content:
            "Cut merchant onboarding from 6 days of manual review to under 2 hours",
          tags: ["commerce", "backend"],
        },
        {
          content:
            "Reduced order-state bugs 70% by replacing ad-hoc flags with an explicit " +
            "state machine",
          tags: ["backend", "reliability"],
        },
      ],
    },
    skills: [
      "skill-nodejs",
      "skill-javascript",
      "skill-postgres",
      "skill-redis",
    ],
  },
  {
    id: "work-sinar",
    favorite: true,
    details: {
      employmentType: "full-time",
      workplaceType: "on-site",
      location: "Surabaya, ID",
    },
    title: "Sinar Logistik",
    subtitle: "Backend Engineer",
    startDate: "2016-02",
    endDate: "2017-07",
    summary:
      "Route planning and driver dispatch for a third-party logistics operator " +
      "running about 600 vehicles across Java.",
    tags: ["logistics", "backend"],
    lines: {
      responsibilities: [
        {
          content:
            "Developed the dispatch API consumed by the driver mobile app",
          tags: ["backend"],
        },
        {
          content: "Maintained nightly route optimisation batch jobs",
          tags: ["backend", "data"],
        },
      ],
      highlights: [
        {
          content:
            "Cut average route computation from 90 to 12 minutes by parallelising " +
            "the solver per region",
          tags: ["performance", "backend"],
        },
        {
          content:
            "Added GPS trace deduplication that removed 30% of storage growth",
          tags: ["cost", "data"],
        },
      ],
    },
    skills: ["skill-python", "skill-postgres", "skill-redis", "skill-docker"],
  },
  {
    id: "work-rimba",
    details: {
      employmentType: "full-time",
      workplaceType: "on-site",
      location: "Bandung, ID",
    },
    title: "Rimba Digital",
    subtitle: "Fullstack Developer",
    startDate: "2014-09",
    endDate: "2016-01",
    summary:
      "Client work at a digital agency — campaign sites, internal dashboards, and " +
      "e-commerce builds for retail and FMCG brands.",
    tags: ["agency", "fullstack"],
    lines: {
      responsibilities: [
        {
          content:
            "Delivered 20+ client projects end to end, design hand-off to launch",
          tags: ["fullstack", "frontend"],
        },
        {
          content: "Acted as technical contact in client scoping meetings",
          tags: ["communication"],
        },
      ],
      highlights: [
        {
          content:
            "Built a reusable campaign-site starter that cut project setup from " +
            "5 days to half a day",
          tags: ["frontend", "fullstack"],
        },
        {
          content:
            "Retained the agency's three largest accounts through relaunches",
          tags: ["communication"],
        },
      ],
    },
    skills: ["skill-javascript", "skill-react", "skill-sql", "skill-nodejs"],
  },
  {
    id: "work-cendana",
    details: {
      employmentType: "contract",
      workplaceType: "on-site",
      location: "Bandung, ID",
    },
    title: "Cendana Software House",
    subtitle: "Software Engineer",
    startDate: "2013-06",
    endDate: "2014-08",
    summary:
      "Custom inventory and point-of-sale software for mid-sized Indonesian retailers.",
    tags: ["backend"],
    lines: {
      responsibilities: [
        {
          content:
            "Built inventory and point-of-sale modules to client specification",
          tags: ["backend"],
        },
        {
          content: "Handled on-site deployment and staff training",
          tags: ["communication"],
        },
      ],
      highlights: [
        {
          content:
            "Wrote an offline-first sync layer so stores kept selling through " +
            "connectivity drops",
          tags: ["backend", "reliability"],
        },
      ],
    },
    skills: ["skill-java", "skill-sql"],
  },
  {
    id: "work-freelance",
    details: {
      employmentType: "freelance",
      workplaceType: "remote",
      location: "Remote, ID",
    },
    title: "Independent",
    subtitle: "Freelance Web Developer",
    startDate: "2012-01",
    endDate: "2013-05",
    summary:
      "Contract web development for small businesses and two early-stage startups.",
    tags: ["freelance", "fullstack"],
    lines: {
      responsibilities: [
        {
          content:
            "Delivered brochure sites and simple web apps for 15+ clients",
          tags: ["fullstack"],
        },
        {
          content: "Managed my own scoping, invoicing, and support",
          tags: ["communication"],
        },
      ],
      highlights: [
        {
          content:
            "Grew entirely through referral — no advertising across 18 months",
          tags: ["communication"],
        },
      ],
    },
    skills: ["skill-javascript", "skill-sql"],
  },
  {
    id: "work-bahari",
    details: {
      employmentType: "part-time",
      workplaceType: "on-site",
      location: "Yogyakarta, ID",
    },
    title: "Bahari Systems",
    subtitle: "Junior Developer",
    startDate: "2011-07",
    endDate: "2011-12",
    summary:
      "First full-time role, maintaining internal tooling for a shipping agency.",
    tags: ["backend"],
    lines: {
      responsibilities: [
        {
          content:
            "Fixed bugs and added reports to an internal manifest system",
          tags: ["backend"],
        },
      ],
      highlights: [
        {
          content:
            "Automated a manual manifest report that had taken two staff a full day each week",
          tags: ["backend"],
        },
      ],
    },
    skills: ["skill-java", "skill-sql"],
  },
  {
    id: "work-cakrawala",
    details: {
      employmentType: "internship",
      workplaceType: "on-site",
      location: "Yogyakarta, ID",
    },
    title: "Cakrawala Tech",
    subtitle: "Software Engineering Intern",
    startDate: "2010-06",
    endDate: "2010-12",
    summary: "Final-year internship on an internal HR portal.",
    tags: ["internship"],
    lines: {
      responsibilities: [
        {
          content:
            "Implemented CRUD screens and form validation on the HR portal",
          tags: ["fullstack"],
        },
      ],
      highlights: [
        {
          content: "Converted to a part-time contract before graduating",
          tags: ["communication"],
        },
      ],
    },
    skills: ["skill-java"],
  },
]
