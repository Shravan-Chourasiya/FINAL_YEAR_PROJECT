# SyntheView AI — What Was Built After August 31st

This document explains everything that was built on the SyntheView AI backend after August 31st, written in plain language so anyone can understand what exists, why it was built, and how the pieces connect.

---

## The Big Picture

SyntheView AI is a platform where a candidate sits down, starts an interview, and an AI asks them questions in real time — adapting based on how well they're doing. Before August 31st, the foundation was in place: user accounts, login/logout, basic interview creation, and a database. After August 31st, the actual interview experience was built — the part where questions get asked, answers get recorded, the AI thinks, and the session stays alive even if the internet hiccups.

---

## 1. Interview Lifecycle — States and Timeouts

**What was built:** A proper state machine for interviews, plus automatic cleanup jobs.

### Interview States

An interview now moves through a defined set of states in a specific order:

```
DRAFT → READY → INPROGRESS → COMPLETED
                           → CANCELLED
                           → ABANDONED
                           → TIMED_OUT
                           → SCHEDULED (paused)
```

You can't jump to an invalid state. For example, a COMPLETED interview can never go back to INPROGRESS. The code enforces this with a transition table — if you try an illegal move, it throws an error immediately.

### Per-Question Timeout (5 minutes)

Every question has a 5-minute clock. If the candidate doesn't answer in time:

- The question is automatically marked `TIMED_OUT`
- An empty answer is recorded with a score of 0
- The AI evaluator is **not** called — no point evaluating a blank answer
- The interview moves on

### Overall Interview Duration Timeout

If the total interview time runs out (e.g. a 30-minute interview that started 30 minutes ago), the whole interview is marked `TIMED_OUT` automatically.

### Stale Interview Abandonment

If an interview has been sitting in `INPROGRESS` with no activity for 90 minutes, a background job marks it `ABANDONED`. This handles cases where someone just closed their browser without cancelling.

### The Maintenance Job

A background job runs every 15 minutes and does three things in order:

1. Times out any questions that have been sitting unanswered too long
2. Times out any interviews that have exceeded their total duration
3. Abandons any interviews that have been inactive for 90+ minutes

---

## 2. Question & Answer Engine

**What was built:** The core loop — deliver a question, receive an answer, move to the next one.

### Delivering a Question

When an interview starts, the system immediately generates the first question and delivers it to the candidate over a live WebSocket connection. The question is saved to the database and tracked as "the current question."

**Reconnect safety:** If the candidate's browser refreshes or their connection drops and they reconnect, the same question is re-delivered — the system never generates a duplicate. It checks "is there already a current question?" before generating a new one.

### Receiving an Answer

When the candidate submits an answer:

1. The system checks it's for the _current_ question (not a stale one from before)
2. It checks no answer has already been recorded for this question (duplicate-submit protection)
3. The answer is saved to the database
4. The question is marked `ANSWERED`

**Double-submit protection:** If a flaky connection causes the same answer to be sent twice, only one answer is ever saved. The second submission is silently ignored and returns the already-saved answer.

### Moving to the Next Question

The candidate (or the system) can request the next question, but only after the current question is in a completed state (`ANSWERED`, `SKIPPED`, `TIMED_OUT`, or `EVALUATED`). If the current question is still `PENDING`, the request is rejected.

### Interview History

Once an interview is finished, you can fetch the full history — every question, its state, the answer given, and the evaluation score — all in order.

---

## 3. Real-Time Communication (WebSocket)

**What was built:** A live two-way connection between the candidate's browser and the server, so questions and feedback arrive instantly without page refreshes.

### How It Works

The candidate connects over a WebSocket (using Socket.IO). The server authenticates them using the same login cookie they already have — no separate login needed for the WebSocket.

### Events the Candidate Can Send

| Event              | What it does                          |
| ------------------ | ------------------------------------- |
| `interview:join`   | Join the interview room               |
| `interview:leave`  | Leave the room                        |
| `answer:submit`    | Submit an answer                      |
| `code:submit`      | Submit code (treated as text for now) |
| `question:next`    | Ask for the next question             |
| `interview:cancel` | Cancel the interview                  |
| `heartbeat:ack`    | Respond to a server ping              |

### Events the Server Sends Back

| Event                    | What it means                          |
| ------------------------ | -------------------------------------- |
| `interview:joined`       | Confirmed you're in, here's your timer |
| `question:delivered`     | Here's your next question              |
| `evaluation:feedback`    | Here's how you did on that answer      |
| `interview:state_change` | The interview status changed           |
| `timer:expired`          | Time's up                              |
| `ws:error`               | Something went wrong                   |

### Disconnect Grace Period

If the candidate's connection drops mid-interview, the server doesn't immediately end the interview. Instead:

1. A 30-second grace period starts
2. If the candidate reconnects within 30 seconds, the interview continues exactly where it left off
3. If 30 seconds pass with no reconnect, the interview is paused (`SCHEDULED`) so it can be resumed later

The current question is **not** auto-submitted on disconnect. The candidate must re-submit after reconnecting. If the question's 5-minute timer also runs out while they're disconnected, the stale-question job handles it.

### Error Handling

All errors go through a dedicated `ws:error` event — they're never mixed into the normal event stream. Every error has a machine-readable code (like `INTERVIEW_NOT_FOUND` or `AUTH_FORBIDDEN`) so the frontend can react to it programmatically, not just display a message.

### Session Registry

The server tracks which socket belongs to which interview in Redis. This is how reconnect detection works — when a candidate rejoins, the server checks if their user ID matches the existing session and clears the grace period.

---

## 4. Interview Session Context (Redis)

**What was built:** A fast in-memory store for everything the server needs to know about a live interview.

While an interview is running, the server keeps a "context" object in Redis (a fast in-memory database). This context holds:

- Which question the candidate is currently answering
- The interview configuration (difficulty, type, duration, etc.)
- When the interview timer started
- The AI thread ID (so the AI can remember the conversation)
- The candidate's running performance scores
- The history of adaptation decisions

This context is the single source of truth during a live session. The PostgreSQL database is the permanent record; Redis is the live scratchpad.

When an interview ends (for any reason), the context is deleted from Redis.

---

## 5. AI Module — In-Process LangGraph Integration

**What was built:** The AI brain that generates questions and evaluates answers, running inside the same server process (no separate Python service).

### The Decision

The AI runs in TypeScript, in the same process as the rest of the backend. There's no separate AI microservice, no network hop, no cross-language serialization. LangGraph (a library for building AI workflows) runs directly inside the Node.js server.

### The Four AI Operations

The rest of the backend only ever calls four functions:

| Function               | What it does                                            |
| ---------------------- | ------------------------------------------------------- |
| `startAiSession`       | Creates a new AI conversation thread for this interview |
| `generateNextQuestion` | Asks the AI to produce the next question                |
| `evaluateAnswer`       | Asks the AI to score the candidate's answer             |
| `endAiSession`         | Closes the AI thread when the interview ends            |

Nothing outside `src/integrations/ai/` is allowed to reach into the AI internals. This is a hard boundary.

### How the AI Graph Works

Inside the AI module, there's a LangGraph "graph" — think of it as a flowchart the AI follows for every turn:

```
START → Router → Interviewer → END   (when generating a question)
START → Router → Evaluator  → END   (when scoring an answer)
```

- **Router node:** Looks at what operation is being requested and decides which path to take
- **Interviewer node:** Generates the next question using the language model
- **Evaluator node:** Scores the candidate's answer across four dimensions (correctness, relevance, clarity, technical depth)

The graph remembers the conversation history across turns using a "thread ID" — each interview has its own thread.

### Multi-Provider Fallback

The AI doesn't rely on a single model provider. It has a fallback chain:

```
Groq → Mistral → Stub (always works)
```

If Groq is down, rate-limited, or times out, it automatically tries Mistral. If Mistral also fails, it falls back to a stub that always returns a valid (if generic) question. A rate limit (429 error) is treated exactly the same as an outage — no special-casing.

Each provider gets 2 retry attempts with exponential backoff before the chain moves on. Each call has an 8-second hard timeout.

### Lookahead Question Caching

To make the interview feel fast, the system generates the _next_ question in the background as soon as the candidate submits their current answer. By the time the candidate finishes reading their feedback, the next question is already ready.

This pre-generated question is stored in Redis with a 10-minute expiry. When the candidate requests the next question, the server checks the cache first — if it's there, it's delivered instantly. If not (cache miss), it generates synchronously.

The adaptive engine can also **discard** a cached question if it decides to change direction (e.g. switch topics) — the pre-generated question is thrown away and a fresh one is generated instead.

### Context Window Management

Different AI providers have different memory limits. The context manager trims the conversation history to fit within the provider's limit before sending it, keeping the most recent exchanges and discarding older ones.

---

## 6. Adaptive Interview Engine

**What was built:** The system that makes the interview smarter over time — harder when the candidate is doing well, easier when they're struggling, and able to end early when appropriate.

### Performance Tracking

After every answer, the system updates a running picture of how the candidate is doing:

- Overall average score
- Per-topic scores (e.g. how are they doing on system design vs. algorithms)
- Streak tracking (how many consecutive strong or weak answers)
- Probe count (how many times we've asked follow-ups on the same vague answer)

### Pattern Detection

After each answer, the system looks for patterns:

- **Strong area:** Candidate is consistently scoring well on a topic
- **Weak area:** Candidate is consistently struggling
- **Vague answer:** The answer was too general or unclear
- **Incomplete answer:** The answer was cut short or missing key parts
- **Off-topic:** The answer didn't address the question

A single bad answer never triggers a pattern — it takes at least 2 consecutive signals before the system acts.

### Adaptation Decisions

Based on the patterns detected, the system makes one of five decisions for the next question:

| Decision    | When it happens                                  |
| ----------- | ------------------------------------------------ |
| `follow_up` | Ask a follow-up on the same topic (default)      |
| `harder`    | Escalate difficulty — candidate is doing well    |
| `easier`    | De-escalate difficulty — candidate is struggling |
| `new_topic` | Switch to a different topic                      |
| `terminate` | End the interview early                          |

**Early termination** happens in two cases:

1. The candidate has given 5 consecutive weak answers with no improvement — the interview ends to avoid prolonging a bad experience
2. The candidate has covered 85%+ of the expected questions with a strong average score — no need to continue

### Wiring It All Together

The adaptation decision is passed to the question generator as a "hint" — the AI uses it to shape the next question. For example, if the decision is `harder`, the AI generates a more difficult question. If it's `new_topic`, the AI pivots to a fresh subject.

When the decision is `terminate`, the system:

1. Calls `endAiSession` to close the AI thread
2. Transitions the interview to `COMPLETED` in the database
3. Broadcasts the state change over the WebSocket so the candidate's browser updates

---

## 7. Evaluation Pipeline

**What was built:** The full pipeline that runs after every answer — from scoring to updating the candidate's performance profile.

The pipeline runs in the background (fire-and-forget) so the candidate's answer submission is never blocked by AI latency. Here's what happens after an answer is saved:

1. **Evaluate:** The AI scores the answer (0–100) across correctness, relevance, clarity, and technical depth
2. **Persist:** The scores are saved to the answer row in the database; the question is marked `EVALUATED`
3. **Update performance state:** The running performance profile is updated with the new score
4. **Detect patterns:** The pattern detector looks at the updated state and recent history
5. **Compute adaptation:** The adaptation engine decides what to do next
6. **Save context:** The updated performance state and adaptation decision are written back to Redis
7. **Handle terminate:** If the decision is `terminate`, end the interview
8. **Discard lookahead:** If the decision is `new_topic`, throw away any pre-generated question
9. **Kick off lookahead:** Generate the next question in the background

If the evaluation pipeline fails for any reason, the error is logged and the system falls back to kicking off a plain lookahead without adaptation — the interview continues, just without the adaptive hint for that one question.

---

## 8. Bug Fixes and Code Quality

### Pre-existing TypeScript Errors Fixed

Two TypeScript errors that existed before this work were fixed:

- `ownership.middleware.ts` — the way route parameters were accessed was typed incorrectly
- `interview.zschema.ts` — an unnecessary type annotation was causing a conflict with TypeScript's strict optional property rules

### Garbled Comment Fixed

A leftover fragment of text (`} whose interview started > QUESTION_TIMEOUT_MS ago...`) was sitting in the middle of `interview.service.ts` as invalid code. This was cleaned up.

---

## 9. Future Scope Markers

Two things are explicitly marked as "not built yet, build here when ready":

### Coding Interviews (codebox integration)

The schema and validation files have `TODO(codebox):` comments at the exact place where `isCodingInterview` (boolean) and `codingConfig` (language, sandbox settings) fields should be added. When the sandboxed code execution integration is ready, both the database schema and the validation schema need to be updated in the same change.

### Adaptive Engine Early Termination (already built above)

This was the main open item from the previous session — it's now fully wired.

---

## Summary of Files Changed or Created

| File                                                             | What changed                                                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/integrations/ai/ai.types.ts`                                | Contract types + Zod schemas for all 4 AI operations                                      |
| `src/integrations/ai/ai.graph.types.ts`                          | Zero-dependency shared types (question history, evaluation shape, detection signals)      |
| `src/integrations/ai/graph.state.ts`                             | LangGraph state schema + bidirectional mapping functions                                  |
| `src/integrations/ai/graph.ts`                                   | LangGraph graph with Router, Interviewer, Evaluator nodes                                 |
| `src/integrations/ai/index.ts`                                   | The only public surface of the AI module (4 functions)                                    |
| `src/integrations/ai/provider.ts`                                | Multi-provider fallback chain (Groq → Mistral → Stub)                                     |
| `src/integrations/ai/context.manager.ts`                         | Trims conversation history to fit provider context windows                                |
| `src/integrations/ai/prompts.ts`                                 | Builds prompts for the Interviewer and Evaluator nodes                                    |
| `src/integrations/ai/lookahead.cache.ts`                         | Redis-backed pre-generated question cache                                                 |
| `src/integrations/ai/question.generator.ts`                      | Delegates to the provider fallback chain                                                  |
| `src/integrations/ai/adaptive/performance.state.ts`              | Tracks running candidate performance scores and streaks                                   |
| `src/integrations/ai/adaptive/detection.ts`                      | Detects patterns (strong/weak/vague/incomplete/off-topic)                                 |
| `src/integrations/ai/adaptive/adaptation.ts`                     | Decides what to do next (harder/easier/new_topic/terminate)                               |
| `src/integrations/ai/adaptive/index.ts`                          | Public surface for the adaptive engine                                                    |
| `src/modules/interview/services/interview.service.ts`            | Full evaluation pipeline, adaptive termination, skip/timeout performance tracking         |
| `src/modules/interview/services/interview.context.service.ts`    | Redis read/write/delete for live interview context                                        |
| `src/modules/interview/types/interview.context.ts`               | Shape of the live session context (now includes performance state + adaptation history)   |
| `src/modules/interview/schemas/interview.schema.ts`              | Added difficulty enum, typed columns, timeout states, future-scope coding config marker   |
| `src/modules/interview/schemas/question.schema.ts`               | Added TIMED_OUT/EVALUATED states, timeout behavior column                                 |
| `src/modules/interview/schemas/answers.schema.ts`                | Replaced boolean with RECEIVED/PERSISTED/EVALUATED state enum                             |
| `src/modules/interview/zodschemas/interview.zschema.ts`          | Added difficulty, maxFollowUps, cross-field validation, future-scope coding config marker |
| `src/modules/interview/middlewares/interviewState.middleware.ts` | Guards routes by required interview status                                                |
| `src/websocket/socket.types.ts`                                  | Full typed WebSocket protocol (all events, payloads, error codes)                         |
| `src/websocket/socket.auth.ts`                                   | Authenticates WebSocket connections using the login cookie                                |
| `src/websocket/socket.registry.ts`                               | Redis registry tracking which socket belongs to which interview                           |
| `src/websocket/socket.server.ts`                                 | Creates and attaches the Socket.IO server                                                 |
| `src/websocket/interview.gateway.ts`                             | All WebSocket event handlers (join, leave, answer, next question, cancel, disconnect)     |
| `src/jobs/abandonStaleInterviews.job.ts`                         | Background job running every 15 minutes                                                   |
| `src/constants/interview.constants.ts`                           | Timeout thresholds (5 min per question, 90 min abandonment)                               |
| `src/constants/errorCodes.ts`                                    | Added ANSWER_REJECTED, QUESTION_NOT_COMPLETED                                             |
| `src/config/env.schema.ts`                                       | Added optional GROQ_API_KEY and MISTRAL_API_KEY                                           |
| `docs/websocket-protocol.md`                                     | Full frontend contract document for the WebSocket protocol                                |
