"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import crypto from "crypto";

type Result = { success: boolean; error?: string; data?: any };

function generateRecoveryCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    codes.push(`${code.substring(0, 4)}-${code.substring(4)}`);
  }
  return codes;
}

// ── 2FA (TOTP) ──────────────────────────────────────────────────

/**
 * Generate a TOTP secret and return the otpauth URI for QR code display.
 */
export async function setup2FA(): Promise<Result> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: appUser } = await supabase
    .from("users")
    .select("id, name, email, totp_enabled")
    .eq("auth_user_id", user.id)
    .single();

  if (!appUser) return { success: false, error: "Usuario no encontrado" };
  if ((appUser as any).totp_enabled) return { success: false, error: "2FA ya esta activado" };

  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer: "BoxFi Partners",
    label: (appUser as any).email ?? (appUser as any).name,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });

  // Generate QR code as base64 data URL
  const uri = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(uri, {
    width: 256,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  // Save secret temporarily (not enabled yet until verified)
  await supabase
    .from("users")
    .update({ totp_secret: secret.base32 })
    .eq("id", (appUser as any).id);

  return {
    success: true,
    data: { uri, secret: secret.base32, qrCode: qrDataUrl },
  };
}

/**
 * Verify a TOTP code and activate 2FA.
 */
export async function verify2FA(token: string): Promise<Result> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: appUser } = await supabase
    .from("users")
    .select("id, totp_secret, totp_enabled")
    .eq("auth_user_id", user.id)
    .single();

  if (!appUser) return { success: false, error: "Usuario no encontrado" };
  const au = appUser as any;
  if (!au.totp_secret) return { success: false, error: "Configura 2FA primero" };
  if (au.totp_enabled) return { success: false, error: "2FA ya esta activado" };

  const totp = new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(au.totp_secret),
  });

  const delta = totp.validate({ token, window: 1 });
  if (delta === null) return { success: false, error: "Codigo incorrecto" };

  // Generate recovery codes
  const recoveryCodes = generateRecoveryCodes(8);

  await supabase
    .from("users")
    .update({ totp_enabled: true, recovery_codes: recoveryCodes })
    .eq("id", au.id);

  revalidatePath("/settings");
  return { success: true, data: { recoveryCodes } };
}

/**
 * Disable 2FA (requires valid code).
 */
export async function disable2FA(token: string): Promise<Result> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: appUser } = await supabase
    .from("users")
    .select("id, totp_secret, totp_enabled")
    .eq("auth_user_id", user.id)
    .single();

  if (!appUser) return { success: false, error: "Usuario no encontrado" };
  const au = appUser as any;
  if (!au.totp_enabled) return { success: false, error: "2FA no esta activado" };

  const totp = new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(au.totp_secret),
  });

  const delta = totp.validate({ token, window: 1 });
  if (delta === null) return { success: false, error: "Codigo incorrecto" };

  await supabase
    .from("users")
    .update({ totp_enabled: false, totp_secret: null, recovery_codes: null })
    .eq("id", au.id);

  revalidatePath("/settings");
  return { success: true };
}

/**
 * Validate 2FA code during login (called from login page).
 */
export async function validate2FALogin(
  email: string,
  token: string
): Promise<Result> {
  const supabase = createServiceRoleClient();

  const { data: appUser } = await supabase
    .from("users")
    .select("id, totp_secret, totp_enabled")
    .eq("email", email)
    .eq("totp_enabled", true)
    .single();

  if (!appUser) return { success: false, error: "2FA no configurado" };
  const au = appUser as any;

  const totp = new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(au.totp_secret),
  });

  const delta = totp.validate({ token, window: 1 });
  if (delta === null) return { success: false, error: "Codigo incorrecto" };

  return { success: true };
}

/**
 * Validate a recovery code during login (one-time use).
 */
export async function validateRecoveryCode(
  email: string,
  code: string
): Promise<Result> {
  const supabase = createServiceRoleClient();

  const { data: appUser } = await supabase
    .from("users")
    .select("id, recovery_codes")
    .eq("email", email)
    .single();

  if (!appUser) return { success: false, error: "Usuario no encontrado" };
  const au = appUser as any;
  const codes: string[] = au.recovery_codes ?? [];

  const normalizedCode = code.trim().toUpperCase();
  const index = codes.findIndex((c: string) => c === normalizedCode);

  if (index === -1) {
    return { success: false, error: "Codigo de respaldo invalido" };
  }

  // Remove used code (one-time use)
  const remaining = codes.filter((_: string, i: number) => i !== index);
  await supabase
    .from("users")
    .update({ recovery_codes: remaining })
    .eq("id", au.id);

  return { success: true };
}

/**
 * Check if a user has 2FA enabled (by email, for login flow).
 */
export async function check2FAEnabled(email: string): Promise<boolean> {
  // Use service role - this runs from login page where there's no auth session
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("users")
    .select("totp_enabled")
    .eq("email", email)
    .single();
  return (data as any)?.totp_enabled === true;
}

// ── Login Logs ──────────────────────────────────────────────────

export async function logLoginAttempt(params: {
  email: string;
  ipAddress: string | null;
  userAgent: string | null;
  status: "success" | "failed" | "blocked";
  failureReason?: string;
}): Promise<void> {
  // Use service role - called from login page without auth session
  const supabase = createServiceRoleClient();

  // Try to find user_id by email
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", params.email)
    .single();

  await supabase.from("login_logs").insert({
    user_id: (user as any)?.id ?? null,
    email: params.email,
    ip_address: params.ipAddress,
    user_agent: params.userAgent,
    status: params.status,
    failure_reason: params.failureReason ?? null,
  });
}

export async function getLoginLogs(
  userId: string,
  limit: number = 20
): Promise<any[]> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("login_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((l: any) => ({
    id: l.id,
    email: l.email,
    ipAddress: l.ip_address,
    userAgent: l.user_agent,
    status: l.status,
    failureReason: l.failure_reason,
    createdAt: l.created_at,
  }));
}

// ── Sessions ────────────────────────────────────────────────────

export async function createSession(params: {
  userId: string;
  sessionToken: string;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<void> {
  const supabase = createServiceRoleClient();

  // Parse device info from user agent
  const ua = params.userAgent ?? "";
  let device = "Desconocido";
  if (ua.includes("Mobile")) device = "Movil";
  else if (ua.includes("Tablet")) device = "Tablet";
  else if (ua.includes("Windows")) device = "Windows";
  else if (ua.includes("Mac")) device = "Mac";
  else if (ua.includes("Linux")) device = "Linux";

  await supabase.from("user_sessions").insert({
    user_id: params.userId,
    session_token: params.sessionToken,
    ip_address: params.ipAddress,
    user_agent: params.userAgent,
    device_info: device,
  });
}

export async function getActiveSessions(userId: string): Promise<any[]> {
  const supabase = createServerSupabaseClient();
  // Sessions active in last 30 days
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("user_sessions")
    .select("*")
    .eq("user_id", userId)
    .gte("last_active_at", cutoff)
    .order("last_active_at", { ascending: false });
  return (data ?? []).map((s: any) => ({
    id: s.id,
    sessionToken: s.session_token,
    ipAddress: s.ip_address,
    deviceInfo: s.device_info,
    userAgent: s.user_agent,
    lastActiveAt: s.last_active_at,
    createdAt: s.created_at,
  }));
}

export async function terminateSession(sessionId: string): Promise<Result> {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("user_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

export async function terminateAllOtherSessions(
  userId: string,
  currentSessionToken: string
): Promise<Result> {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("user_sessions")
    .delete()
    .eq("user_id", userId)
    .neq("session_token", currentSessionToken);
  if (error) return { success: false, error: error.message };
  revalidatePath("/settings");
  return { success: true };
}
