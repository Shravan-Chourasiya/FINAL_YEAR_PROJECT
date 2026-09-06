# SyntheView AI — WebSocket Protocol Reference

**Protocol version:** `1`  
**Transport:** Socket.IO v4 over WebSocket (with HTTP long-poll fallback)  
**Base URL:** same host/port as the HTTP API  
**Namespace:** `/` (default)

---

## 1. Overview

All real-time interview communication happens over a single Socket.IO connection.
The connection is authenticated, bound to a specific interview session, and carries
events in both directions.

### 1.1 Versioning

Every payload in both directions carries:

```json
{ "eventVersion": 1, "event": "<event-name>", ... }
```

- `eventVersion` is a plain integer. Bump it when a **breaking** change is made to any event shape.
- The frontend should reject (and log) any payload whose `eventVersion` differs from the version it was built against.
- Additive changes (new optional fields) do **not** require a version bump.

### 1.2 Error events

Errors are **always** emitted on the dedicated `ws:error` event name — never mixed into the normal event stream. The client can distinguish a failure from a state update with a single event-name check.

```ts
socket.on("ws:error", (err) => { /* err.code, err.message, err.interviewId? */ });
```

See §4 for the full error shape and all error codes.

---

## 2. Connection & Authentication

### 2.1 Connecting

```ts
import { io } from "socket.io-client";

const socket = io("https://api.syntheview.ai", {
  withCredentials: true,   // required — sends the access_token cookie
  reconnection:    true,
  reconnectionDelay:      1000,
  reconnectionDelayMax:   5000,
  reconnectionAttempts:   10,
});
```

### 2.2 Auth mechanism

The server reads the `access_token` **HttpOnly cookie** from the Socket.IO handshake headers.
No separate token or query-string parameter is needed or accepted.

- If the cookie is missing, expired, or blacklisted the connection is **rejected** before it is established — the client receives a standard Socket.IO connection error.
- There is no separate WebSocket auth event; authentication happens at the transport handshake.

### 2.3 Heartbeat

Socket.IO's built-in transport-level ping/pong runs automatically:

| Parameter     | Value  |
|---------------|--------|
| pingInterval  | 25 s   |
| pingTimeout   | 20 s   |

In addition, the server emits an **application-level** `heartbeat:ping` event. The client **must** respond with `heartbeat:ack` within the ping timeout or the connection is considered dead.

```ts
socket.on("heartbeat:ping", (payload) => {
  socket.emit("heartbeat:ack", {
    eventVersion: 1,
    event: "heartbeat:ack",
  });
});
```

---

## 3. Interview Session Lifecycle

### 3.1 Joining an interview

After connecting, the client must join a specific interview room before any interview events flow.

**Client emits → `interview:join`**

```json
{
  "eventVersion": 1,
  "event": "interview:join",
  "interviewId": "<uuid>"
}
```

**Server emits → `interview:joined`** (on success)

```json
{
  "eventVersion": 1,
  "event": "interview:joined",
  "interviewId": "<uuid>",
  "reconnected": false,
  "timerStartedAt": "2025-01-15T10:00:00.000Z",
  "durationMinutes": 45
}
```

- `reconnected: true` means the server found an existing session for this user+interview and cancelled the pending grace-period expiry.
- `timerStartedAt` + `durationMinutes` let the client derive the countdown: `deadline = new Date(timerStartedAt).getTime() + durationMinutes * 60_000`.

**Rejection** → `ws:error` with code `INTERVIEW_NOT_FOUND`, `AUTH_FORBIDDEN`, `INTERVIEW_INVALID_STATE`, or `CONTEXT_MISSING`.

### 3.2 Leaving an interview

**Client emits → `interview:leave`**

```json
{
  "eventVersion": 1,
  "event": "interview:leave",
  "interviewId": "<uuid>"
}
```

**Server emits → `interview:left`**

```json
{
  "eventVersion": 1,
  "event": "interview:left",
  "interviewId": "<uuid>"
}
```

### 3.3 Interview state changes

Emitted by the server whenever the interview transitions to a new status. The client should treat this as the **authoritative source of truth** for interview status — do not rely on polling the REST API during an active session.

**Server emits → `interview:state_change`**

```json
{
  "eventVersion": 1,
  "event": "interview:state_change",
  "interviewId": "<uuid>",
  "status": "COMPLETED",
  "timestamp": "2025-01-15T10:45:00.000Z"
}
```

Possible `status` values: `DRAFT` · `READY` · `SCHEDULED` · `INPROGRESS` · `COMPLETED` · `CANCELLED` · `ABANDONED` · `EXPIRED` · `TIMED_OUT`

### 3.4 Cancelling an interview

**Client emits → `interview:cancel`**

```json
{
  "eventVersion": 1,
  "event": "interview:cancel",
  "interviewId": "<uuid>"
}
```

The server transitions the interview to `CANCELLED` and broadcasts `interview:state_change` to all sockets in the room.

### 3.5 Disconnect & reconnect

**Disconnect:** when the socket disconnects, the server starts a **30-second grace period**. If the client reconnects and re-emits `interview:join` within that window, the session is restored and `reconnected: true` is returned. The interview stays `INPROGRESS`.

**Hard disconnect:** if the grace period expires without a reconnect, the server transitions the interview to `SCHEDULED` (paused) and emits `interview:state_change { status: "SCHEDULED" }` to any remaining room members.

---

## 4. Error Event

All errors are emitted on `ws:error`. **Never** branch on `message` — it is for humans only. Always branch on `code`.

**Server emits → `ws:error`**

```json
{
  "eventVersion": 1,
  "event": "ws:error",
  "code": "INTERVIEW_INVALID_STATE",
  "message": "Interview must be INPROGRESS to perform this action",
  "interviewId": "<uuid>",
  "timestamp": "2025-01-15T10:05:00.000Z"
}
```

| Field         | Type   | Notes                                              |
|---------------|--------|----------------------------------------------------|
| `eventVersion`| number | Protocol version                                   |
| `event`       | string | Always `"ws:error"`                                |
| `code`        | string | Machine-readable — see table below                 |
| `message`     | string | Human-readable — do not branch on this             |
| `interviewId` | string | Present when the error is scoped to an interview   |
| `timestamp`   | string | ISO-8601                                           |

### Error codes

| Code                      | Meaning                                                    |
|---------------------------|------------------------------------------------------------|
| `AUTH_UNAUTHORIZED`       | No valid access token in the handshake                     |
| `AUTH_SESSION_EXPIRED`    | Token is expired or blacklisted                            |
| `AUTH_FORBIDDEN`          | Authenticated but does not own the requested interview     |
| `INTERVIEW_NOT_FOUND`     | No interview with the given ID exists                      |
| `INTERVIEW_INVALID_STATE` | Interview is not in the required state for this action     |
| `QUESTION_NOT_FOUND`      | The referenced question does not exist                     |
| `ANSWER_REJECTED`         | Answer failed validation (e.g. wrong question state)       |
| `CONTEXT_MISSING`         | Redis session context not found — interview not started    |
| `INTERNAL_ERROR`          | Unexpected server error                                    |

---

## 5. Question Lifecycle

### 5.1 Requesting the next question

**Client emits → `question:next`**

```json
{
  "eventVersion": 1,
  "event": "question:next",
  "interviewId": "<uuid>"
}
```

The server acknowledges with `ai:status { stage: "thinking" }` immediately, then delivers the question once the AI engine has generated it.

### 5.2 Question delivered

**Server emits → `question:delivered`**

```json
{
  "eventVersion": 1,
  "event": "question:delivered",
  "interviewId": "<uuid>",
  "questionId": "<uuid>",
  "sequenceNumber": 1,
  "totalQuestions": null,
  "questionTitle": "Describe a time you resolved a conflict in your team.",
  "questionDescription": "Focus on your specific role and the outcome.",
  "questionType": "BEHAVIORAL",
  "deliveredAt": "2025-01-15T10:01:00.000Z",
  "timeoutSeconds": 300
}
```

- `totalQuestions` is `null` until the AI engine resolves the final count for this session.
- `timeoutSeconds` is always `300` (5 minutes). The client starts its own countdown from `deliveredAt`.
- When the client's countdown reaches zero it should submit an empty answer via `answer:submit` (which the server will mark as `SKIPPED`).

### 5.3 AI processing status

Emitted while the AI engine is working. Use this to show a progress indicator.

**Server emits → `ai:status`**

```json
{
  "eventVersion": 1,
  "event": "ai:status",
  "interviewId": "<uuid>",
  "questionId": "<uuid>",
  "stage": "generating",
  "timestamp": "2025-01-15T10:01:00.500Z"
}
```

| `stage`       | Meaning                                          |
|---------------|--------------------------------------------------|
| `thinking`    | AI received the request, deciding what to ask    |
| `generating`  | AI is writing the question / follow-up           |
| `evaluating`  | AI is scoring a submitted answer                 |

---

## 6. Answer Submission

### 6.1 Text / audio / video answer

**Client emits → `answer:submit`**

```json
{
  "eventVersion": 1,
  "event": "answer:submit",
  "interviewId": "<uuid>",
  "questionId": "<uuid>",
  "answerData": "I resolved the conflict by...",
  "answerType": "TEXT"
}
```

| `answerType` | `answerData` content                        |
|--------------|---------------------------------------------|
| `TEXT`       | Plain transcript string                     |
| `AUDIO`      | URL to uploaded audio file                  |
| `VIDEO`      | URL to uploaded video file                  |

- Submitting an **empty** `answerData` (after trimming) marks the question as `SKIPPED`.
- On success the server begins evaluation and emits `ai:status { stage: "evaluating" }` followed by `evaluation:feedback` when scoring is complete.

### 6.2 Code answer

**Client emits → `code:submit`**

```json
{
  "eventVersion": 1,
  "event": "code:submit",
  "interviewId": "<uuid>",
  "questionId": "<uuid>",
  "language": "python",
  "code": "def two_sum(nums, target):\n    ..."
}
```

- `language` is a lowercase string matching common identifiers: `"python"`, `"typescript"`, `"java"`, `"cpp"`, `"go"`, etc.
- The codebox sandbox integration is not yet implemented; code is persisted as a TEXT answer until Step N.

---

## 7. Evaluation Feedback

Emitted after the AI has scored an answer. The client may display this immediately or buffer it until the interview ends.

**Server emits → `evaluation:feedback`**

```json
{
  "eventVersion": 1,
  "event": "evaluation:feedback",
  "interviewId": "<uuid>",
  "questionId": "<uuid>",
  "answerId": "<uuid>",
  "score": 78,
  "correctness": 80,
  "relevance": 85,
  "clarity": 70,
  "technicalDepth": 75,
  "feedback": "Good structure. Consider elaborating on the outcome.",
  "strengths": ["Clear problem statement", "Concrete action taken"],
  "weaknesses": ["Outcome was vague", "No mention of lessons learned"],
  "timestamp": "2025-01-15T10:03:30.000Z"
}
```

All numeric scores are integers in the range **0–100**.

---

## 8. Timer

The client derives the interview countdown locally:

```ts
const deadline = new Date(timerStartedAt).getTime() + durationMinutes * 60_000;
const remaining = deadline - Date.now(); // milliseconds
```

When the server's maintenance job detects the deadline has passed it transitions the interview to `TIMED_OUT` and emits two events:

**Server emits → `timer:expired`**

```json
{
  "eventVersion": 1,
  "event": "timer:expired",
  "interviewId": "<uuid>",
  "expiredAt": "2025-01-15T10:45:00.000Z"
}
```

**Server emits → `interview:state_change`** (immediately after)

```json
{
  "eventVersion": 1,
  "event": "interview:state_change",
  "interviewId": "<uuid>",
  "status": "TIMED_OUT",
  "timestamp": "2025-01-15T10:45:00.000Z"
}
```

The client should show the termination screen on either event — whichever arrives first.

---

## 9. Complete Event Reference

### Client → Server

| Event name         | When to emit                                      |
|--------------------|---------------------------------------------------|
| `interview:join`   | After connecting, to bind to an interview room    |
| `interview:leave`  | When navigating away from the interview UI        |
| `interview:cancel` | Candidate voluntarily ends the session            |
| `answer:submit`    | After the candidate finishes answering            |
| `code:submit`      | After the candidate finishes a coding question    |
| `question:next`    | When the candidate is ready for the next question |
| `heartbeat:ack`    | In response to every `heartbeat:ping` from server |

### Server → Client

| Event name               | When emitted                                                  |
|--------------------------|---------------------------------------------------------------|
| `interview:joined`       | Successful `interview:join` (includes timer anchor)           |
| `interview:left`         | Successful `interview:leave`                                  |
| `interview:state_change` | Any interview status transition                               |
| `question:delivered`     | AI has generated the next question                            |
| `ai:status`              | AI engine stage change (thinking / generating / evaluating)   |
| `evaluation:feedback`    | AI has finished scoring an answer                             |
| `timer:expired`          | Wall-clock duration exceeded                                  |
| `heartbeat:ping`         | Application-level liveness check (client must ack)            |
| `ws:error`               | Any server-side error — always on this dedicated event name   |

---

## 10. Typical Session Flow

```
Client                                    Server
  |                                          |
  |── connect (with cookie) ───────────────>|  handshake auth
  |                                          |
  |── interview:join ──────────────────────>|  ownership + state check
  |<── interview:joined (timerStartedAt) ───|
  |                                          |
  |── question:next ───────────────────────>|
  |<── ai:status { stage: "thinking" } ─────|
  |<── ai:status { stage: "generating" } ───|
  |<── question:delivered ──────────────────|  client starts 5-min countdown
  |                                          |
  |── answer:submit ───────────────────────>|
  |<── ai:status { stage: "evaluating" } ───|
  |<── evaluation:feedback ─────────────────|
  |                                          |
  |  ... repeat for each question ...        |
  |                                          |
  |<── timer:expired ───────────────────────|  wall-clock deadline hit
  |<── interview:state_change (TIMED_OUT) ──|
  |                                          |
  |── disconnect ──────────────────────────>|  grace period starts (30 s)
```

---

## 11. Implementation Notes for the Frontend

1. **Always listen on `ws:error`** before emitting any interview events — errors can arrive at any time.
2. **Derive the countdown client-side** from `timerStartedAt` + `durationMinutes` in the `interview:joined` payload. Do not poll the REST API for time remaining.
3. **On `interview:state_change`**, update your local state machine immediately. Do not wait for a REST response to confirm.
4. **On reconnect** (`reconnected: true` in `interview:joined`), restore the UI from the last known local state — the server session is intact.
5. **Empty answer submission**: if the per-question countdown reaches zero, emit `answer:submit` with `answerData: ""`. The server marks the question `SKIPPED` automatically.
6. **`eventVersion` mismatch**: if you receive a payload with `eventVersion !== 1`, log a warning and treat the event as unknown — do not crash.
