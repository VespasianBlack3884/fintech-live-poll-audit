import { strict as assert } from "node:assert";
import { decidePaymentAction } from "../src/fintech_poll.ts";

assert.equal(decidePaymentAction({ amount: 1200, votes: { approve: 8, review: 2 } }), "approve");
assert.equal(decidePaymentAction({ amount: 1200, votes: { approve: 2, review: 8 } }), "review");
assert.equal(decidePaymentAction({ amount: 7000, votes: { approve: 20, review: 0 } }), "review");
console.log("payment poll decisions pass");
