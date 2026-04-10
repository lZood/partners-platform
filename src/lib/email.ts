import nodemailer from "nodemailer";

/**
 * Creates a nodemailer transporter using the app's SMTP config.
 * Uses your own Mailu (or any SMTP server) to send emails
 * instead of relying on Supabase's built-in email.
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
    // Port 25: disable TLS entirely — plain SMTP on internal/trusted network
    // Port 587: use STARTTLS
    // Port 465: implicit TLS
    ...(isImplicitTLS
      ? { tls: { rejectUnauthorized: false } }
      : isSubmission
      ? { requireTLS: true, tls: { rejectUnauthorized: false } }
      : {
          // Port 25: no TLS at all
          ignoreTLS: true,
          tls: { rejectUnauthorized: false },
        }),
    // Timeouts
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  } as any);
}

/**
 * Get the sender address from env, with fallback.
 */
function getSender(): string {
  return (
    process.env.SMTP_FROM ??
    process.env.SMTP_USER ??
    "noreply@box-build.com"
  );
}

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

    await transporter.sendMail({
      from: `"Partners Platform" <${from}>`,
      to: params.to,
      subject: "Invitacion a Partners Platform",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background: #18181b; color: white; width: 48px; height: 48px; line-height: 48px; border-radius: 10px; font-size: 20px; font-weight: bold;">P</div>
            </div>

            <h1 style="font-size: 22px; font-weight: 700; color: #18181b; text-align: center; margin: 0 0 8px;">
              Bienvenido a Partners Platform
            </h1>

            <p style="color: #71717a; text-align: center; font-size: 15px; margin: 0 0 32px;">
              Hola <strong>${params.userName}</strong>, has sido invitado a unirte a la plataforma de gestion de partners.
            </p>

            <div style="text-align: center; margin-bottom: 32px;">
              <a href="${params.inviteLink}"
                 style="display: inline-block; background: #18181b; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
                Configurar mi Contraseña
              </a>
            </div>

            <p style="color: #a1a1aa; font-size: 13px; text-align: center; margin: 0 0 16px;">
              Este enlace expira en 24 horas. Si no solicitaste esta invitacion, puedes ignorar este correo.
            </p>

            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">

            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              Si el boton no funciona, copia y pega este enlace en tu navegador:<br>
              <a href="${params.inviteLink}" style="color: #3b82f6; word-break: break-all;">${params.inviteLink}</a>
            </p>
          </div>
        </body>
        </html>
      `,
      text: `Hola ${params.userName}, has sido invitado a Partners Platform. Configura tu contraseña aqui: ${params.inviteLink}`,
    });

    return { success: true };
  } catch (error: any) {
    const msg =
      error?.message ??
      (typeof error === "object" ? JSON.stringify(error) : String(error));
    return {
      success: false,
      error: `Error enviando email: ${msg}`,
    };
  }
}

/**
 * Test SMTP connection — useful for diagnostics.
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
    return {
      success: false,
      error: error?.message ?? String(error),
    };
  }
}
