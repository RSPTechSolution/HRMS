import "server-only";

export type MailMessage = { to: string; subject: string; text: string };

/** In tests, sent mail is collected here instead of being delivered. */
export const outbox: MailMessage[] = [];

export async function sendMail(msg: MailMessage): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    outbox.push(msg);
    return;
  }
  // Console transport for local development. An SMTP transport replaces this before go-live.
  console.info(`\n[mail] to: ${msg.to}\n[mail] subject: ${msg.subject}\n${msg.text}\n`);
}
