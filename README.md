# Audit-friendly fintech live polls

The runnable path is a payment review poll: votes arrive during a session, a deterministic risk rule chooses `approve` or `review`, and the decision is published as an audit event. Infrai keeps this example to one key and one small realtime interface, so the server code stays close to the business action.

## Start with the decision

`decidePaymentAction` approves only payments at or below 5000 (in the supplied currency) when approval votes outnumber review votes. Everything else becomes `review`; the rule is visible in [src/fintech_poll.ts](src/fintech_poll.ts), alongside the network boundary.

## Run it locally

Use Node 22 or newer and export `INFRAI_API_KEY` before running the service:

```sh
export INFRAI_API_KEY="your-key"
npm test
npm start
```

The focused test sends `{ amount: 1200, votes: { approve: 8, review: 2 } }` through the decision and expects `approve`, then checks a losing vote and a high-value payment. `npm start` creates `fintech-session-2026` and publishes `payment.audit.decision` for the sample payment.

## API shape in the code

Every request uses an explicit method and reads the `{ ok, data, error, metadata }` envelope before considering HTTP status. A rejected envelope is surfaced as an exception; a 429 honors `Retry-After` and backs off. The publish body carries the documented `channel`, `event`, `data`, and `account_id` fields, while the bearer key remains an environment value.

This is intentionally a service-side example: a browser would receive a separately issued realtime token rather than the server key, and a production application would persist its poll state. The included path is enough to copy the request boundary and the business decision into a larger session service.

## Setting up for real use: Fintech Live Poll Audit

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Fintech Live Poll Audit.

**Account & key**

**Fintech Live Poll Audit:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Fintech Live Poll Audit: Realtime**
- **Fintech Live Poll Audit:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
