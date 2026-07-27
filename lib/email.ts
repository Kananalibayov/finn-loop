// Email sending via SMTP (nodemailer). Config stored in app_settings.
// All functions are best-effort (never throw) — email is non-critical.

import nodemailer from "nodemailer";
import { getAppSettings } from "@/lib/db";

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
}

export function getEmailConfig(): EmailConfig | null {
  const s = getAppSettings();
  if (!s || !s.smtp_host) return null;
  if (!s.smtp_host || !s.smtp_user || !s.smtp_pass) return null;
  return {
    smtpHost: s.smtp_host,
    smtpPort: parseInt(s.smtp_port || "587", 10),
    smtpUser: s.smtp_user,
    smtpPass: s.smtp_pass,
    smtpFrom: s.smtp_from || s.smtp_user,
  };
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  const config = getEmailConfig();
  if (!config) {
    console.warn("[email] No SMTP config — skipping email to", input.to);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass },
    });

    await transporter.sendMail({
      from: config.smtpFrom,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return true;
  } catch (e) {
    console.error("[email] send failed:", (e as Error).message);
    return false;
  }
}

/** Notify the operator of a new change request. */
export async function notifyOperatorChangeRequest(
  instruction: string,
  clientName: string,
  businessName: string,
): Promise<void> {
  const s = getAppSettings();
  const notifyEmail = s?.notify_operator_email;
  if (!notifyEmail) return;

  await sendEmail({
    to: notifyEmail,
    subject: `New change request from ${clientName}`,
    text: `${clientName} requested a change to "${businessName}":\n\n${instruction}\n\nReview at your dashboard: /requests`,
    html: `<p><strong>${clientName}</strong> requested a change to <strong>${businessName}</strong>:</p><blockquote>${instruction}</blockquote><p><a href="/requests">Review in dashboard</a></p>`,
  });
}

/** Notify a client their request was completed. */
export async function notifyClientRequestCompleted(
  clientEmail: string,
  clientName: string,
  instruction: string,
): Promise<void> {
  await sendEmail({
    to: clientEmail,
    subject: "Your change request has been completed",
    text: `Hi ${clientName},\n\nYour request "${instruction.substring(0, 100)}" has been completed and applied to your website.\n\nView your site at the portal.`,
    html: `<p>Hi ${clientName},</p><p>Your request "<em>${instruction.substring(0, 100)}</em>" has been completed and applied to your website.</p><p><a href="/portal">View your site</a></p>`,
  });
}
