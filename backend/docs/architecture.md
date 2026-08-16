# Backend Architecture — Module Boundaries

Status: **Locked for Phase 1.** Any change to the boundaries below is a breaking
architectural change and must be proposed as an update to this file (with a new
entry in the Decision Log) before code is written against the new shape.

This document is the source of truth for how `backend/src` is organized. Folder
names alone do not define a boundary — this file does. If a folder's
responsibility isn't written down here, it doesn't have one yet, and nothing
should be added to it until it does.

---

## 1. Top-level shape

```
backend/src/
├── modules/            # feature modules — one per business capability
│   ├── auth/
│   ├── interview/
│   ├── analytics/
│   └── admin/
├── integrations/        # outbound connectors to external/heavy systems
│   ├── ai/
│   └── codebox/
├── shared/               # cross-module building blocks
│   ├── services/
│   ├── repositories/
│   ├── validators/
│   ├── models/
│   └── middleware/
├── config/               # env parsing, app-wide config (exists today)
└── utils/                # generic, stateless helpers (exists today)
```

Every folder in `src` maps to exactly one row in this document. If you can't
find a folder's responsibility below, raise it before adding files to it.

---

## 2. Feature modules

A **module** owns one business capability end-to-end: HTTP routes, request
validation wiring, controllers, and any orchestration logic that is specific
to that capability and not reusable elsewhere.

### 2.1 `modules/auth`
Owns: registration, login/logout, session/token issuance and refresh,
password reset, account verification.
Contains: `auth.routes.ts`, `auth.controller.ts`, module-local orchestration
(e.g. "on login, verify credentials then issue a session") that isn't
reusable outside auth.
Does **not** contain: password hashing utilities, user persistence, or the
JWT/session validation schema — those live in `shared/` because other
modules (interview, admin) need to read "who is the current user" without
importing from `modules/auth`.

### 2.2 `modules/interview`
Owns: interview session lifecycle (create, start, progress through
questions, submit answers, end), real-time orchestration of a session,
and coding-question submissions.
Contains: `interview.routes.ts`, `interview.controller.ts`, session
state/orchestration logic specific to running an interview.
Consumes: `integrations/ai` (generate/evaluate questions),
`integrations/codebox` (execute candidate code), and `shared/services`
(persist sessions, read user identity).
This is the only module allowed to call `integrations/codebox`.

### 2.3 `modules/analytics`
Owns: aggregating interview results into reports and dashboards, scoring
trends, candidate/recruiter-facing summaries.
Contains: `analytics.routes.ts`, `analytics.controller.ts`, report-shaping
logic.
Consumes: `shared/repositories` (read historical interview data) and,
optionally, `integrations/ai` for narrative summary generation — but never
`integrations/codebox` (analytics never executes code).
Does **not** recompute or re-derive raw interview data — it reads what
`modules/interview` has already persisted through `shared/repositories`.

### 2.4 `modules/admin`
Owns: user/account management, moderation, module configuration/feature
flags, an operator's view over analytics.
Contains: `admin.routes.ts`, `admin.controller.ts`.
Consumes: `shared/services` only. Admin is a *consumer* of what auth,
interview, and analytics expose through shared services — it never imports
directly from another module's folder (see Rule 3.1).

### 2.5 What stays shared instead of living in a module
Anything needed by **two or more** modules moves to `shared/` immediately,
even if only one module currently uses it. In practice this means:
- User identity/session lookup (needed by interview, analytics, admin)
- Data persistence for users, sessions, interview results
- Input validation schemas that appear in more than one module's routes

---

## 3. Cross-module rules

### Rule 3.1 — No module imports another module
`modules/admin` must never `import ... from "../interview/..."` (or any
other module). If admin needs interview data, it goes through a
`shared/services` function that both modules call. This is what keeps
modules independently deletable/replaceable.

### Rule 3.2 — Integrations are one-directional
`integrations/ai` and `integrations/codebox` are consumed **by** modules.
They never import from `modules/*` or `shared/*` (other than shared
`types`/`validators` for the shape of their own input/output). An
integration is a thin, swappable client for an external capability — it
must not know anything about interviews, users, or business rules.

Allowed: `modules/interview → integrations/ai`
Forbidden: `integrations/ai → modules/interview`

### Rule 3.3 — Only the owning module calls its integration
- `integrations/codebox` is called only from `modules/interview`.
- `integrations/ai` may be called from `modules/interview` and
  `modules/analytics`.
If a third module later needs an integration, that need should be pushed
into a `shared/services` wrapper rather than letting every module reach
into the integration directly — revisit this rule at that point rather
than quietly bypassing it.

---

## 4. Shared layer contract: services / repositories / validators

Three kinds of things live in `shared/`, each with a single direction of
dependency. This is the rule most likely to be violated by accident, so it
is stated explicitly:

```
validators  →  (depends on nothing internal)
repositories → validators, models
services    → repositories, validators
modules     → services   (never repositories or validators directly)
```

- **`shared/validators/`** — Zod schemas only. Pure data-shape definitions
  (request bodies, DB row shapes). No I/O, no imports from services or
  repositories. Both a controller and a repository may import the same
  validator to agree on a shape.
- **`shared/repositories/`** — Data access only (DB queries/ORM calls).
  A repository function takes/returns plain data and does not contain
  business rules ("is this session allowed to end" is a business rule and
  does not belong here — "update session row's status column" does).
  Repositories may import validators and models. They never import services.
- **`shared/services/`** — Business logic. Services call one or more
  repositories, apply validation/business rules, and are what modules
  actually call. Services may import repositories and validators. Services
  never import from `modules/*`.
- **`shared/models/`** — Shared TypeScript types/DB schema definitions used
  by repositories and validators to stay in sync.

**The one rule that must never be broken:** a repository must never call a
service, and a validator must never call a repository or service. Dependency
flows one way: validators are the foundation, repositories sit on top of
validators, services sit on top of repositories, and modules sit on top of
services. If you find yourself importing "up" this chain, the code is in
the wrong layer.

Controllers inside a module may call a validator directly (to validate an
incoming request) and must call services for anything that touches data or
business logic. Controllers never call repositories directly.

---

## 5. Folder-to-responsibility map (must stay in sync with `src/`)

| Folder | Responsibility | Depends on |
|---|---|---|
| `modules/auth` | registration, login, sessions, password reset | `shared/services` |
| `modules/interview` | interview session lifecycle, real-time orchestration | `shared/services`, `integrations/ai`, `integrations/codebox` |
| `modules/analytics` | reporting/dashboards over past interviews | `shared/services`, `integrations/ai` (optional) |
| `modules/admin` | user/account management, moderation, config | `shared/services` |
| `integrations/ai` | client for AI question-gen/evaluation provider(s) | `shared/validators`/`models` only |
| `integrations/codebox` | client for sandboxed code execution | `shared/validators`/`models` only |
| `shared/services` | business logic, cross-module operations | `shared/repositories`, `shared/validators` |
| `shared/repositories` | data access (DB) | `shared/validators`, `shared/models` |
| `shared/validators` | Zod schemas | nothing internal |
| `shared/models` | shared types / DB schema | nothing internal |
| `shared/middleware` | Express middleware reused across modules (e.g. auth guard) | `shared/services` |
| `config` | env parsing, app configuration | nothing internal |
| `utils` | generic stateless helpers (logging, formatting) | nothing internal |

Any new top-level folder under `src/` requires a new row here before it is
used.

---

## 6. Decision Log

Keep entries short: date, decision, why. Add to the bottom; never rewrite
history above.

- **2026-08-14** — Established the four feature modules (auth, interview,
  analytics, admin), the two integrations (ai, codebox), and the
  services/repositories/validators shared-layer split described above.
  Rationale: interview is the only module needing codebox; analytics and
  admin must not become tightly coupled to interview internals as the
  candidate/session data model grows in Phase 2.
- **2026-08-16** — Decided to keep `integrations/ai` in Node/TypeScript
  (no separate Python AI service, e.g. LangChain, spun up as a
  separate microservice). `integrations/ai`'s job is a thin, mostly
  stateless request/response wrapper around an LLM API (generate/evaluate
  interview questions) — this doesn't need Python's heavier ML tooling, and
  staying in-process avoids an extra network hop in the real-time interview
  flow plus a second service to deploy/monitor. If `ai` work later grows
  into something genuinely ML-heavy (local embeddings, a vector DB
  pipeline, custom scoring models), revisit this decision then — the
  integration boundary (Rule 3.2/3.3) is designed so `integrations/ai`'s
  internals could be swapped for an HTTP client to a separate service
  without any module code changing.
