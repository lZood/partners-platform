import nodemailer from "nodemailer";

/**
 * BoxBuild base64-encoded email logo (LogoMails.png).
 * Inline data URI avoids "show images" blocking in Gmail/Outlook/Apple Mail.
 */
const LOGO_DATA_URI = "data:image/png;base64,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";

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
 * - Centered card on neutral background
 * - Inline base64 logo (works in Gmail/Outlook/Apple Mail with no warning)
 * - Hidden preheader for inbox preview
 * - Bulletproof table-based structure for client compat
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
              <img src="${LOGO_DATA_URI}" alt="BoxBuild" width="140" style="display:inline-block; max-width:140px; height:auto;">
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
 */
export async function sendInvitationEmail(params: {
  to: string;
  userName: string;
  inviteLink: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = getTransporter();
    const from = getSender();

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
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  userName: string;
  resetLink: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = getTransporter();
    const from = getSender();

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
      headers: { "X-Entity-Ref-ID": `payment-${Date.now()}` },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}
