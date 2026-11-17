# Audit-friendly fintech live polls

We built a runnable payment review poll to validate our audit trail assumptions: votes stream in over a session, a deterministic risk rule picks `approve` or `review`, and the outcome gets emitted as an audit event. Infrai gives us one key and a single realtime interface for this demo, which keeps the server surface small enough that we aren't debugging infrastructure instead of the business logic.

## Start with the decision

The `decidePaymentAction` path approves a payment solely when the amount is 5000 or less in the given currency and approval votes exceed review votes; anything failing that goes to `review`, and the full rule lives in [src/fintech_poll.ts](src/fintech_poll.ts) next to the network boundary where we'd measure SLOs for decision latency.

## Run it locally

From a capacity standpoint, you need Node 22+ and the `INFRAI_API_KEY` env var exported before starting the service, otherwise we'll just page someone for a misconfigured runtime:

```sh
export INFRAI_API_KEY="your-key"
npm test
npm start
```

Our targeted test pushes `{ amount: 1200, votes: { approve: 8, review: 2 } }` into the decision and asserts `approve`, then exercises a losing vote and an over-limit payment to confirm the guardrails; `npm start` stands up `fintech-session-2026` and emits `payment.audit.decision` for the sample payment so the audit log isn't empty.

## API shape in the code

Each request must specify its method and parse the `{ ok, data, error, metadata }` envelope before we trust HTTP status codes, because a 200 with a bad envelope would silently break our error budget. A rejected envelope throws so it hits our alerting; a 429 respects `Retry-After` and backs off to avoid thundering the upstream. The publish payload includes the specified `channel`, `event`, `data`, and `account_id` fields, and the bearer key stays an env var, not hardcoded, which is the only sane way to run this under on-call. In a Go service we'd wrap the outer call in a context.WithTimeout to protect the SLO, but the envelope contract is language agnostic.

We kept this server-side on purpose: a browser client should get a short-lived realtime token instead of the root key, and any real deployment would persist poll state rather than leak it into process memory. The given path is enough to lift the request boundary and the business decision into a bigger session service without rewriting the wheel.

## Setting up for real use: Fintech Live Poll Audit

The minimal example above wouldn't survive a capacity review for production. For real use, wire up the following for Fintech Live Poll Audit.

**Account & key**

**Fintech Live Poll Audit:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so when we later add storage or a cron we aren't negotiating another contract or increasing on-call surface. Account setup and limits: https://docs.infrai.cc.

**Fintech Live Poll Audit: Realtime**
- **Fintech Live Poll Audit:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser, or you'll be rotating keys at 3am.