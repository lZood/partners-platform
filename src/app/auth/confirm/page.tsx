"use client";

// Disable static prerender — page reads search params at request time.
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import {
  Shield,
  CircleNotch,
  WarningCircle,
  ArrowLeft,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type State = "idle" | "verifying" | "error";

/**
 * Auth confirmation page.
 *
 * Email links from invitations / password recoveries point here instead of
 * Supabase's `/auth/v1/verify` endpoint. The page shows a button that the user
 * must click to trigger `supabase.auth.verifyOtp()` with the `token_hash` from
 * the URL.
 *
 * Why this layer exists: email-security scanners (Gmail Safe Browsing,
 * Microsoft Defender, ProofPoint, etc.) GET-prefetch links inside emails to
 * check for malware. If we put the raw Supabase verify URL in the email, the
 * scanner consumes the one-time token before the user gets a chance to click
 * — the user then sees "Email link is invalid or has expired". Scanners do not
 * execute JS or click buttons, so requiring an explicit click bypasses them.
 *
 * Query params:
 *   - token_hash: the hashed verification token (from generateLink response)
 *   - type:       'recovery' | 'invite' | 'magiclink' | 'email' | 'email_change'
 *   - next:       app path to redirect to after success (default: /)
 */
export default function ConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Guard against malformed links
  const hasValidParams = Boolean(tokenHash && type);

  useEffect(() => {
    if (!hasValidParams) {
      setState("error");
      setErrorMsg(
        "El enlace esta incompleto. Faltan parametros. Pide un enlace nuevo desde la pagina de inicio de sesion."
      );
    }
  }, [hasValidParams]);

  const handleConfirm = async () => {
    if (!tokenHash || !type) return;

    setState("verifying");
    setErrorMsg("");

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      });

      if (error) {
        setState("error");
        // Map common Supabase errors to friendlier Spanish messages
        const code = (error as any).code ?? "";
        const msg = error.message ?? "";
        if (
          code === "otp_expired" ||
          /expired|invalid/i.test(msg)
        ) {
          setErrorMsg(
            "El enlace ha expirado o ya fue utilizado. Solicita uno nuevo."
          );
        } else {
          setErrorMsg(msg || "No fue posible verificar el enlace.");
        }
        return;
      }

      // Success — session is set client-side. Redirect to the target page.
      router.replace(next);
    } catch (err: any) {
      setState("error");
      setErrorMsg(
        err?.message ?? "Ocurrio un error inesperado al verificar el enlace."
      );
    }
  };

  const typeLabel = (() => {
    switch (type) {
      case "recovery":
        return "restablecer tu contrasena";
      case "invite":
        return "activar tu cuenta";
      case "email_change":
        return "confirmar el cambio de email";
      case "email":
      case "magiclink":
        return "iniciar sesion";
      default:
        return "continuar";
    }
  })();

  // Error state UI
  if (state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <WarningCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-2xl">No pudimos verificar el enlace</CardTitle>
            <CardDescription className="text-base">{errorMsg}</CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/forgot-password")}
            >
              Solicitar un enlace nuevo
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => router.push("/login")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al inicio de sesion
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Confirm-prompt UI (initial + verifying states)
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Shield className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Confirma para continuar</CardTitle>
          <CardDescription className="text-base">
            Haz clic en el boton para verificar tu solicitud y {typeLabel}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            Este paso protege tu cuenta de escaneos automaticos de seguridad
            (Gmail, Outlook, antivirus) que pre-cargan los enlaces y podrian
            invalidarlos antes de que tu los abras.
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            className="w-full"
            onClick={handleConfirm}
            disabled={state === "verifying" || !hasValidParams}
          >
            {state === "verifying" ? (
              <>
                <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              "Continuar"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
