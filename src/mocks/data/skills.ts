import type { SourceItem } from "../types"

/**
 * Twenty skills. `subtitle` carries `resume.json`'s `level`, `yearsExperience` is our
 * own column, and `keywords` become nested lines a CV can select individually.
 *
 * Every skill referenced by `item_skills` in work.ts and projects.ts is defined here —
 * `flatten.ts` throws if that ever stops being true.
 */
export const skills: SourceItem[] = [
  {
    id: "skill-go",
    title: "Go",
    subtitle: "Advanced",
    yearsExperience: 5,
    tags: ["language", "backend"],
    lines: {
      keywords: [
        "Goroutines",
        "Context propagation",
        "pprof",
        "Standard library HTTP",
      ],
    },
  },
  {
    id: "skill-typescript",
    title: "TypeScript",
    subtitle: "Expert",
    yearsExperience: 8,
    tags: ["language", "backend", "frontend"],
    lines: {
      keywords: [
        "Generics",
        "Discriminated unions",
        "Type-level programming",
        "tRPC",
      ],
    },
  },
  {
    id: "skill-javascript",
    title: "JavaScript",
    subtitle: "Expert",
    yearsExperience: 13,
    tags: ["language", "backend", "frontend"],
    lines: { keywords: ["ES2023", "Event loop internals", "Web APIs"] },
  },
  {
    id: "skill-python",
    title: "Python",
    subtitle: "Intermediate",
    yearsExperience: 6,
    tags: ["language", "data"],
    lines: { keywords: ["asyncio", "pandas", "FastAPI"] },
  },
  {
    id: "skill-java",
    title: "Java",
    subtitle: "Intermediate",
    yearsExperience: 4,
    tags: ["language", "backend"],
    lines: { keywords: ["Spring Boot", "JDBC", "Maven"] },
  },
  {
    id: "skill-sql",
    title: "SQL",
    subtitle: "Expert",
    yearsExperience: 12,
    tags: ["language", "data"],
    lines: {
      keywords: ["Window functions", "CTEs", "Query planning", "Index design"],
    },
  },
  {
    id: "skill-nodejs",
    title: "Node.js",
    subtitle: "Expert",
    yearsExperience: 10,
    tags: ["runtime", "backend"],
    lines: { keywords: ["Streams", "Worker threads", "Clustering"] },
  },
  {
    id: "skill-react",
    title: "React",
    subtitle: "Advanced",
    yearsExperience: 7,
    tags: ["framework", "frontend"],
    lines: {
      keywords: [
        "Hooks",
        "Suspense",
        "Server Components",
        "Concurrent rendering",
      ],
    },
  },
  {
    id: "skill-nextjs",
    title: "Next.js",
    subtitle: "Advanced",
    yearsExperience: 4,
    tags: ["framework", "frontend"],
    lines: { keywords: ["App Router", "Streaming SSR", "Route handlers"] },
  },
  {
    id: "skill-tailwind",
    title: "Tailwind CSS",
    subtitle: "Advanced",
    yearsExperience: 3,
    tags: ["framework", "frontend"],
    lines: { keywords: ["Design tokens", "Container queries", "Theming"] },
  },
  {
    id: "skill-postgres",
    favorite: true,
    title: "PostgreSQL",
    subtitle: "Expert",
    yearsExperience: 11,
    tags: ["database", "data", "backend"],
    lines: {
      keywords: [
        "Partitioning",
        "Logical replication",
        "EXPLAIN ANALYZE",
        "Row-level security",
      ],
    },
  },
  {
    id: "skill-redis",
    title: "Redis",
    subtitle: "Advanced",
    yearsExperience: 7,
    tags: ["database", "backend"],
    lines: { keywords: ["Streams", "Lua scripting", "Cluster mode"] },
  },
  {
    id: "skill-kafka",
    title: "Apache Kafka",
    subtitle: "Advanced",
    yearsExperience: 5,
    tags: ["streaming", "data", "backend"],
    lines: {
      keywords: [
        "Exactly-once semantics",
        "Consumer groups",
        "Schema Registry",
      ],
    },
  },
  {
    id: "skill-elasticsearch",
    title: "Elasticsearch",
    subtitle: "Intermediate",
    yearsExperience: 4,
    tags: ["search", "data"],
    lines: {
      keywords: ["Analyser chains", "Relevance tuning", "Aggregations"],
    },
  },
  {
    id: "skill-docker",
    title: "Docker",
    subtitle: "Advanced",
    yearsExperience: 8,
    tags: ["infrastructure", "platform"],
    lines: { keywords: ["Multi-stage builds", "Compose", "Image hardening"] },
  },
  {
    id: "skill-kubernetes",
    favorite: true,
    title: "Kubernetes",
    subtitle: "Advanced",
    yearsExperience: 5,
    tags: ["infrastructure", "platform"],
    lines: { keywords: ["Operators", "HPA", "Network policies", "Helm"] },
  },
  {
    id: "skill-aws",
    title: "AWS",
    subtitle: "Advanced",
    yearsExperience: 7,
    tags: ["infrastructure", "platform"],
    lines: { keywords: ["EKS", "RDS", "S3", "IAM", "Cost Explorer"] },
  },
  {
    id: "skill-terraform",
    title: "Terraform",
    subtitle: "Intermediate",
    yearsExperience: 4,
    tags: ["infrastructure", "platform"],
    lines: { keywords: ["Module design", "Remote state", "Drift detection"] },
  },
  {
    id: "skill-grpc",
    title: "gRPC",
    subtitle: "Advanced",
    yearsExperience: 4,
    tags: ["protocol", "backend"],
    lines: { keywords: ["Protocol Buffers", "Streaming RPC", "Interceptors"] },
  },
  {
    id: "skill-observability",
    title: "Observability",
    subtitle: "Advanced",
    yearsExperience: 5,
    tags: ["platform", "reliability"],
    lines: {
      keywords: [
        "OpenTelemetry",
        "Prometheus",
        "Distributed tracing",
        "SLO design",
      ],
    },
  },
]
