import { runPaymentPoll } from "./fintech_poll.ts";

const result = await runPaymentPoll({
  channel: "fintech-session-2026",
  accountId: "acct_demo",
  paymentId: "pay_1001",
  amount: 1200,
  currency: "USD",
  votes: { approve: 8, review: 2 }
});

console.log(JSON.stringify(result));
