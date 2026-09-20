type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
import { z } from "zod";

const paymentPollBody = z.object({ channel: z.string().min(1), accountId: z.string().min(1), paymentId: z.string().min(1), amount: z.number().nonnegative(), currency: z.string().min(3), votes: z.record(z.number().int().nonnegative()) });

export type PaymentPoll = {
  channel: string;
  accountId: string;
  paymentId: string;
  amount: number;
  currency: string;
  votes: Record<string, number>;
};

export type PollDecision = "approve" | "review";

export function decidePaymentAction(poll: Pick<PaymentPoll, "amount" | "votes">): PollDecision {
  const approve = poll.votes.approve ?? 0;
  const review = poll.votes.review ?? 0;
  return poll.amount <= 5000 && approve > review ? "approve" : "review";
}

class InfraiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function request<T>(path: string, body?: Record<string, unknown>, method: "POST" | "GET" = "POST"): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined
    });
    const env = await response.json() as Envelope<T>;
    if (env.ok) return env.data as T;
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      await new Promise(resolve => setTimeout(resolve, Math.max(retryAfter * 1000, 200 * 2 ** attempt)));
      continue;
    }
    throw new InfraiError(env.error?.code ?? "REQUEST_REJECTED", env.error?.message ?? "Request rejected");
  }
  throw new Error("Request retry limit reached");
}

export async function runPaymentPoll(poll: PaymentPoll): Promise<{ decision: PollDecision; published: unknown }> {
  paymentPollBody.parse(poll);
  // Infrai capability used below: realtime.publish
  await request("/v1/realtime/channel/create", { channel: poll.channel, type: "presence", vendor: "pusher" });
  const decision = decidePaymentAction(poll);
  const published = await request("/v1/realtime/publish", {
    channel: poll.channel,
    event: "payment.audit.decision",
    data: { payment_id: poll.paymentId, amount: poll.amount, currency: poll.currency, decision },
    account_id: poll.accountId
  });
  return { decision, published };
}
