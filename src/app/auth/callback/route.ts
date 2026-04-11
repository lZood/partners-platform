import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if this is an OAuth user (Google) and ensure they have a users record
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const serviceClient = createServiceRoleClient();

        // Check if user record already exists
        const { data: existingUser } = await serviceClient
          .from("users")
          .select("id")
          .eq("auth_user_id", user.id)
          .single();

        if (!existingUser) {
          // First time OAuth login — create user record
          const name =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split("@")[0] ||
            "Usuario";
          const email = user.email || "";
          const avatarUrl = user.user_metadata?.avatar_url || null;

          await serviceClient.from("users").insert({
            auth_user_id: user.id,
            name,
            email,
            user_type: "system_user",
            avatar_url: avatarUrl,
          });
        }
      }

      // If the redirect target is /auth/set-password, send them there
      if (next.includes("/auth/set-password")) {
        return NextResponse.redirect(`${origin}/auth/set-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Check for token_hash (used in invite/magic link email flows)
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (tokenHash && type) {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as any,
    });

    if (!error) {
      // Invited users should set their password
      if (type === "invite" || type === "magiclink") {
        return NextResponse.redirect(`${origin}/auth/set-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }

    // If OTP verification failed, redirect to set-password with error info
    // so the page can display a proper error message
    const errorParams = new URLSearchParams({
      error: "access_denied",
      error_code: "otp_expired",
      error_description: "El enlace de invitacion ha expirado o es invalido. Solicita uno nuevo a tu administrador.",
    });
    return NextResponse.redirect(
      `${origin}/auth/set-password#${errorParams.toString()}`
    );
  }

  // Return the user to login with a generic error
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
