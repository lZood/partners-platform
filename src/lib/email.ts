import nodemailer from "nodemailer";
import { readFile } from "fs/promises";
import path from "path";

/**
 * BoxBuild logo as a nodemailer attachment with a stable CID.
 *
 * We use CID (Content-ID) instead of a remote URL or inline base64 data URI:
 *   - Remote URL: Gmail/Outlook block external images by default → broken icon.
 *   - Inline data URI: long lines get mangled by SMTP quoted-printable wrapping
 *     in many clients (notably Gmail) → broken image.
 *   - CID: a proper MIME inline attachment, rendered as part of the email body
 *     by every modern email client without "show images" prompts.
 *
 * The buffer is cached at module level after first read.
 */
let _logoBuffer: Buffer | null = null;
const LOGO_CID = "boxbuild-logo";

async function getLogoAttachment() {
  if (!_logoBuffer) {
    const logoPath = path.join(process.cwd(), "public", "brand", "LogoMails.png");
    _logoBuffer = await readFile(logoPath);
  }
  return {
    filename: "logo.png",
    content: _logoBuffer,
    cid: LOGO_CID,
    contentType: "image/png",
    contentDisposition: "inline" as const,
  };
}

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.box-build.com").replace(/\/$/, "");
const APP_HOST = APP_URL.replace(/^https?:\/\//, "");
const CURRENT_YEAR = new Date().getFullYear();

/**
 * Build a nodemailer transporter from SMTP_* env vars.
 *  - port 25  → plaintext (used inside trusted networks)
 *  - port 465 → implicit TLS
 *  - port 587 → STARTTLS submission
 */
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "Faltan variables SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS). Configuralas en las variables de entorno."
    );
  }

  const isImplicitTLS = port === 465;
  const isSubmission = port === 587;

  return nodemailer.createTransport({
    host,
    port,
    secure: isImplicitTLS,
    auth: { user, pass },
    ...(isImplicitTLS
      ? { tls: { rejectUnauthorized: false } }
      : isSubmission
      ? { requireTLS: true, tls: { rejectUnauthorized: false } }
      : { ignoreTLS: true, tls: { rejectUnauthorized: false } }),
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  } as any);
}

function getSender(): string {
  return (
    process.env.SMTP_FROM ??
    process.env.SMTP_USER ??
    "noreply@box-build.com"
  );
}

/**
 * Reusable transactional email layout.
 * Centered card with CID-embedded logo header, slot content, and footer.
 */
function renderEmailLayout(opts: {
  preheader: string;
  title: string;
  intro: string;
  contentHtml: string;
  recipient: string;
}): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${opts.title}</title>
</head>
<body style="margin:0; padding:0; background:#f4f4f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; color:#18181b; -webkit-font-smoothing:antialiased;">
  <span style="display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; mso-hide:all;">${opts.preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5; padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px; background:#ffffff; border-radius:16px; box-shadow:0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04); overflow:hidden;">
          <tr>
            <td style="padding:40px 40px 24px; text-align:center; border-bottom:1px solid #f4f4f5;">
              <img src="cid:${LOGO_CID}" alt="BoxBuild" width="140" style="display:inline-block; max-width:140px; height:auto;">
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 12px; font-size:22px; font-weight:700; color:#18181b; text-align:center; letter-spacing:-0.4px;">${opts.title}</h1>
              <p style="margin:0 0 32px; font-size:15px; line-height:1.6; color:#52525b; text-align:center;">${opts.intro}</p>
              ${opts.contentHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 32px; background:#fafafa; border-top:1px solid #f4f4f5; text-align:center;">
              <p style="margin:0; font-size:12px; color:#a1a1aa; line-height:1.6;">
                Este correo fue enviado a <a href="mailto:${opts.recipient}" style="color:#71717a; text-decoration:none;">${opts.recipient}</a>.<br>
                © ${CURRENT_YEAR} BoxBuild · <a href="${APP_URL}" style="color:#71717a; text-decoration:none;">${APP_HOST}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Bulletproof button using nested table for Outlook compatibility. */
function renderButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px;">
    <tr>
      <td style="border-radius:10px; background:#18181b;">
        <a href="${href}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:10px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

/** Fallback plain link block shown below the button. */
function renderFallbackLink(url: string): string {
  return `<p style="margin:32px 0 0; padding:16px; background:#fafafa; border-radius:8px; font-size:12px; color:#71717a; line-height:1.6; word-break:break-all;">
    Si el boton no funciona, copia y pega este enlace en tu navegador:<br>
    <a href="${url}" style="color:#3b82f6; text-decoration:none;">${url}</a>
  </p>`;
}

/* ─────────────────────────────────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────────────────────────────── */

/**
 * Send an invitation email with a link to set their password.
 * `inviteLink` should be a link to our own /auth/confirm wrapper, NOT the raw
 * Supabase /auth/v1/verify URL — email-security scanners GET-prefetch and burn
 * raw verify links before the user clicks.
 */
export async function sendInvitationEmail(params: {
  to: string;
  userName: string;
  inviteLink: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = getTransporter();
    const from = getSender();
    const logoAttachment = await getLogoAttachment();

    const html = renderEmailLayout({
      preheader: `${params.userName}, te invitaron a BoxBuild — activa tu cuenta.`,
      title: "Bienvenido a BoxBuild",
      intro: `Hola <strong style="color:#18181b;">${params.userName}</strong>, has sido invitado a unirte a la plataforma de gestion de partners. Crea tu contrasena para activar tu cuenta.`,
      contentHtml: `
        ${renderButton(params.inviteLink, "Activar mi cuenta")}
        <p style="margin:0; font-size:13px; color:#a1a1aa; text-align:center;">Este enlace expira en <strong>24 horas</strong>.</p>
        ${renderFallbackLink(params.inviteLink)}
      `,
      recipient: params.to,
    });

    await transporter.sendMail({
      from: `"BoxBuild" <${from}>`,
      to: params.to,
      subject: "Invitacion a BoxBuild — activa tu cuenta",
      html,
      text: `Hola ${params.userName}, has sido invitado a unirte a BoxBuild. Activa tu cuenta aqui: ${params.inviteLink} (expira en 24 horas).`,
      attachments: [logoAttachment],
      headers: { "X-Entity-Ref-ID": `invite-${Date.now()}` },
    });

    return { success: true };
  } catch (error: any) {
    const msg = error?.message ?? (typeof error === "object" ? JSON.stringify(error) : String(error));
    return { success: false, error: `Error enviando email: ${msg}` };
  }
}

/**
 * Send a password reset email.
 * `resetLink` should be a link to our own /auth/confirm wrapper (see comment above).
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  userName: string;
  resetLink: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = getTransporter();
    const from = getSender();
    const logoAttachment = await getLogoAttachment();

    const html = renderEmailLayout({
      preheader: "Restablece tu contrasena de BoxBuild.",
      title: "Restablecer contrasena",
      intro: `Hola <strong style="color:#18181b;">${params.userName}</strong>, recibimos una solicitud para restablecer tu contrasena. Si fuiste tu, haz clic en el boton. Si no, puedes ignorar este correo de forma segura.`,
      contentHtml: `
        ${renderButton(params.resetLink, "Restablecer contrasena")}
        <p style="margin:0; font-size:13px; color:#a1a1aa; text-align:center;">Este enlace expira en <strong>1 hora</strong>.</p>
        ${renderFallbackLink(params.resetLink)}
      `,
      recipient: params.to,
    });

    await transporter.sendMail({
      from: `"BoxBuild" <${from}>`,
      to: params.to,
      subject: "Restablecer tu contrasena — BoxBuild",
      html,
      text: `Hola ${params.userName}, recibimos una solicitud para restablecer tu contrasena. Usa este enlace (expira en 1 hora): ${params.resetLink}`,
      attachments: [logoAttachment],
      headers: { "X-Entity-Ref-ID": `recovery-${Date.now()}` },
    });

    return { success: true };
  } catch (error: any) {
    const msg = error?.message ?? (typeof error === "object" ? JSON.stringify(error) : String(error));
    return { success: false, error: `Error enviando email: ${msg}` };
  }
}

/**
 * Test SMTP connection — used by the settings diagnostics.
 */
export async function testSmtpConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

/**
 * Send a notification when a new earnings report is generated.
 */
export async function sendReportNotificationEmail(params: {
  to: string;
  userName: string;
  reportMonth: string;
  partnerName: string;
  totalUsd: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = getTransporter();
    const from = getSender();
    const logoAttachment = await getLogoAttachment();
    const amount = `$${params.totalUsd.toFixed(2)} USD`;
    const dashboardUrl = `${APP_URL}/reports`;

    const html = renderEmailLayout({
      preheader: `${params.partnerName} — ${amount} en ${params.reportMonth}`,
      title: "Nuevo reporte de ganancias",
      intro: `Hola <strong style="color:#18181b;">${params.userName}</strong>, se genero un nuevo reporte para <strong>${params.partnerName}</strong>.`,
      contentHtml: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eff6ff; border-radius:12px; margin:0 0 24px;">
          <tr>
            <td style="padding:24px; text-align:center;">
              <p style="margin:0 0 4px; font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Tus ganancias del periodo</p>
              <p style="margin:8px 0 4px; font-size:32px; font-weight:800; color:#0f172a; letter-spacing:-1px;">${amount}</p>
              <p style="margin:0; font-size:13px; color:#64748b;">${params.reportMonth}</p>
            </td>
          </tr>
        </table>
        ${renderButton(dashboardUrl, "Ver detalle en la plataforma")}
      `,
      recipient: params.to,
    });

    await transporter.sendMail({
      from: `"BoxBuild" <${from}>`,
      to: params.to,
      subject: `Nuevo reporte de ganancias — ${params.reportMonth}`,
      html,
      text: `Hola ${params.userName}, se genero un nuevo reporte para ${params.partnerName}. Tus ganancias: ${amount} (${params.reportMonth}). Ver detalle: ${dashboardUrl}`,
      attachments: [logoAttachment],
      headers: { "X-Entity-Ref-ID": `report-${Date.now()}` },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

/**
 * Send a notification when a payment is registered against the user.
 */
export async function sendPaymentNotificationEmail(params: {
  to: string;
  userName: string;
  totalUsd: number;
  totalMxn: number;
  paymentMethod: string | null;
  paidAt: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = getTransporter();
    const from = getSender();
    const logoAttachment = await getLogoAttachment();
    const amountUsd = `$${params.totalUsd.toFixed(2)} USD`;
    const amountMxn = `$${params.totalMxn.toFixed(2)} MXN`;
    const date = new Date(params.paidAt).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const paymentsUrl = `${APP_URL}/payments`;

    const metaRows: string[] = [
      `<tr><td style="padding:4px 0; font-size:13px; color:#71717a;"><strong style="color:#52525b;">Fecha:</strong> ${date}</td></tr>`,
    ];
    if (params.paymentMethod) {
      metaRows.push(
        `<tr><td style="padding:4px 0; font-size:13px; color:#71717a;"><strong style="color:#52525b;">Metodo:</strong> ${params.paymentMethod}</td></tr>`
      );
    }

    const html = renderEmailLayout({
      preheader: `Pago de ${amountUsd} registrado a tu favor.`,
      title: "Pago registrado",
      intro: `Hola <strong style="color:#18181b;">${params.userName}</strong>, se ha registrado un pago a tu favor.`,
      contentHtml: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fdf4; border-radius:12px; margin:0 0 24px;">
          <tr>
            <td style="padding:24px; text-align:center;">
              <p style="margin:0 0 4px; font-size:12px; color:#15803d; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Monto del pago</p>
              <p style="margin:8px 0 4px; font-size:32px; font-weight:800; color:#0f172a; letter-spacing:-1px;">${amountUsd}</p>
              <p style="margin:0; font-size:14px; color:#64748b;">${amountMxn}</p>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa; border-radius:8px; margin:0 0 24px;">
          <tr><td style="padding:16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${metaRows.join("")}</table>
          </td></tr>
        </table>
        ${renderButton(paymentsUrl, "Ver pago y descargar recibo")}
      `,
      recipient: params.to,
    });

    await transporter.sendMail({
      from: `"BoxBuild" <${from}>`,
      to: params.to,
      subject: `Pago registrado — ${amountUsd}`,
      html,
      text: `Hola ${params.userName}, se registro un pago de ${amountUsd} (${amountMxn}) a tu favor. Fecha: ${date}. Ver detalle: ${paymentsUrl}`,
      attachments: [logoAttachment],
      headers: { "X-Entity-Ref-ID": `payment-${Date.now()}` },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}
