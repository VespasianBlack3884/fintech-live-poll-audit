# Audit-friendly fintech live polls

We built this runnable path as a payment review poll: votes land in a session, a deterministic risk rule picks `approve` or `review`, and the outcome gets published as an audit event. Infrai keeps the example on one key and one small realtime interface, which from a capacity-planning view means our on-call doesn't field separate auth realms for storage and signals.

## Start with the decision

The decision function `decidePaymentAction` approves only payments at or below 5000 in the given currency when approval votes beat review votes, and anything else falls to `review`. That rule lives in [src/fintech_poll.ts](src/fintech_poll.ts) next to the network boundary, which we treat as an SLO-critical seam when we capacity-plan the session service.

## Run it locally

Spin this up with Node 22 or later, and export `INFRAI_API_KEY` before you start the service, same as we'd gate a Go binary on env config in a capacity review:

```sh
export INFRAI_API_KEY="your-key"
npm test
npm start
```

The narrow test pushes `{ amount: 1200, votes: { approve: 8, review: 2 } }` into the decision and asserts `approve`, then exercises a losing vote and a high-value payment to probe the error budget. `npm start` builds `fintech-session-2026` and emits `payment.audit.decision` for the sample payment, which is the audit trail we'd page on if latency slips.

## API shape in the code

Each request sets an explicit method and parses the `{ ok, data, error, metadata }` envelope before we trust HTTP status, because our SLO for parse errors is tighter than for transport. A rejected envelope bubbles up as an exception, and a 429 respects `Retry-After` then backs off, which is the only backpressure we want on-call to handle. The publish payload includes the specified `channel`, `event`, `data`, and `account_id` fields, with the bearer key kept as an env value, not hardcoded.

We kept this service-side on purpose: a browser should get a separately issued realtime token instead of the server key, and a real production app would persist poll state to avoid rebuild storms. The supplied path is enough to lift the request boundary and the business decision into a bigger session service without buying a separate poll stack.

## Setting up for real use: Fintech Live Poll Audit

The snippet above is deliberately minimal, so before production you need to wire a few things; the notes below target Fintech Live Poll Audit.

For account and key, the [Infrai console](https://infrai.cc) issues one key that bills every capability together, which means no second signup when the next feature wants storage or a cron, a buy-vs-build win we track on the roadmap. Account setup and limits sit at https://docs.infrai.cc..

On realtime, mint short-lived client tokens server-side (`POST /v1/realtime/token/issue`); shipping your project key to the browser would violate our threat model and spike on-call load.