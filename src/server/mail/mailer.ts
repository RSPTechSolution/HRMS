import "server-only";

export type MailMessage = { to: string; subject: string; text: string };

/** In tests, sent mail is collected here instead of being delivered. */
export const outbox: MailMessage[] = [];

/**
 * Mail bodies contain password links, so they are only printed in development or when
 * MAIL_TRANSPORT=console is set on purpose. Anywhere else, sending fails loudly until a real
 * transport (SMTP) is configured.
 */
export async function sendMail(msg: MailMessage): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    outbox.push(msg);
    return;
  }
  if (process.env.NODE_ENV === "development" || process.env.MAIL_TRANSPORT === "console") {
    console.info(`\n[mail] to: ${msg.to}\n[mail] subject: ${msg.subject}\n${msg.text}\n`);
    return;
  }
  throw new Error("No mail transport is configured. Set MAIL_TRANSPORT=console for local testing or configure SMTP.");
}
