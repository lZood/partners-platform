"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  XCircle,
  KeyRound,
} from "lucide-react";
import { activateCurrentUser } from "@/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PageState = "loading" | "error" | "form" | "success";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [pageState, setPageState] = useState<PageState>("loading");
  const [hashError, setHashError] = useState<{
    code: string;
    description: string;
  } | null>(null);
  const [userName, setUserName] = useState("");
  const [isPasswordChange, setIsPasswordChange] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    // 1. Parse error from URL hash fragment (Supabase sends errors here)
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const errorCode = params.get("error_code");
      const errorDesc = params.get("error_description");
      const error = params.get("error");

      if (error || errorCode) {
        setHashError({
          code: errorCode ?? error ?? "unknown",
          description: errorDesc
            ? decodeURIComponent(errorDesc.replace(/\+/g, " "))
            : "Ocurrio un error desconocido",
        });
        setPageState("error");
        return;
      }

      // If there's an access_token in the hash, Supabase may auto-set the session
      // We need to manually set the session from the hash tokens
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      if (accessToken && refreshToken) {
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(() => checkSession())
          .catch(() => checkSession());
        return;
      }
      if (accessToken) {
        // Fallback: wait for supabase client to auto-detect
        setTimeout(() => checkSession(), 1000);
        return;
      }
    }

    // 2. Check if there's an active session
    checkSession();
  }, []);

  async function checkSession() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setHashError({
        code: "no_session",
        description:
          "No se encontro una sesion activa. Esto puede suceder si el enlace de invitacion ha expirado o ya fue utilizado.",
      });
      setPageState("error");
      return;
    }

    // Check if user already has a password set (password change vs first setup)
    // Users invited by email have an `invited_at` field
    const hasBeenInvited = !!user.user_metadata?.invited_at || !!user.invited_at;
    const confirmedAt = user.confirmed_at;
    const lastSignIn = user.last_sign_in_at;

    // If user has signed in before (not just confirmed), it's a password change
    // For invited users on first visit, last_sign_in_at might equal confirmed_at
    if (lastSignIn && confirmedAt && lastSignIn !== confirmedAt) {
      setIsPasswordChange(true);
    }

    if (user.user_metadata?.name) {
      setUserName(user.user_metadata.name);
    }

    setPageState("form");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (password.length < 6) {
      setFormError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      // Translate common Supabase errors
      const msg = translateAuthError(updateError.message);
      setFormError(msg);
      return;
    }

    // Activate the user in the users table (invited users start as inactive)
    await activateCurrentUser();

    setPageState("success");

    setTimeout(() => {
      if (isPasswordChange) {
        // Password recovery — sign out and redirect to login
        await supabase.auth.signOut();
        router.push("/login");
      } else {
        router.push("/");
      }
    }, 2000);
  };

  // ── Error descriptions ────────────────────────────────────────────

  function getErrorTitle(code: string): string {
    switch (code) {
      case "otp_expired":
        return "Enlace expirado";
      case "access_denied":
        return "Acceso denegado";
      case "no_session":
        return "Sesion no encontrada";
      default:
        return "Error de autenticacion";
    }
  }

  function getErrorAdvice(code: string): string {
    switch (code) {
      case "otp_expired":
        return "El enlace de invitacion ha expirado. Pide a tu administrador que te reenvie la invitacion desde el panel de colaboradores.";
      case "access_denied":
        return "No se pudo verificar tu identidad. El enlace pudo haber sido usado anteriormente o haber expirado. Contacta a tu administrador para recibir una nueva invitacion.";
      case "no_session":
        return "No hay una sesion activa. Si recibiste un correo de invitacion, intenta hacer clic en el enlace nuevamente. Si el problema persiste, pide a tu administrador que reenvie la invitacion.";
      default:
        return "Contacta a tu administrador para obtener un nuevo enlace de invitacion.";
    }
  }

  function translateAuthError(msg: string): string {
    if (msg.includes("Auth session missing")) {
      return "Tu sesion ha expirado. Solicita un nuevo enlace de invitacion a tu administrador.";
    }
    if (msg.includes("same_password")) {
      return "La nueva contraseña debe ser diferente a la actual.";
    }
    if (msg.includes("weak_password")) {
      return "La contraseña es demasiado debil. Usa al menos 6 caracteres.";
    }
    return msg;
  }

  // ── Render: Loading ───────────────────────────────────────────────

  if (pageState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Verificando sesion...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render: Error ─────────────────────────────────────────────────

  if (pageState === "error" && hashError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-red-800">
              {getErrorTitle(hashError.code)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">{hashError.description}</p>
            </div>

            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                {getErrorAdvice(hashError.code)}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => router.push("/login")}>
                Ir al inicio de sesion
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render: Success ───────────────────────────────────────────────

  if (pageState === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
              <h2 className="text-xl font-bold text-green-800">
                {isPasswordChange
                  ? "Contraseña actualizada"
                  : "Contraseña configurada"}
              </h2>
              <p className="text-muted-foreground">
                {isPasswordChange
                  ? "Tu contraseña ha sido cambiada exitosamente. Redirigiendo al login..."
                  : "Tu cuenta esta lista. Redirigiendo al dashboard..."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render: Form ──────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {isPasswordChange ? (
              <KeyRound className="h-6 w-6 text-primary" />
            ) : (
              <Lock className="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle>
            {isPasswordChange
              ? "Cambiar Contraseña"
              : "Configura tu Contraseña"}
          </CardTitle>
          <CardDescription>
            {isPasswordChange ? (
              userName ? (
                <>
                  Hola, <span className="font-medium">{userName}</span>. Ingresa
                  tu nueva contraseña.
                </>
              ) : (
                "Ingresa tu nueva contraseña."
              )
            ) : userName ? (
              <>
                Bienvenido, <span className="font-medium">{userName}</span>.
                Crea una contraseña para acceder a la plataforma.
              </>
            ) : (
              "Crea una contraseña para acceder a la plataforma."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">
                {isPasswordChange ? "Nueva Contraseña" : "Contraseña"}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                Confirmar{" "}
                {isPasswordChange ? "Nueva Contraseña" : "Contraseña"}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {formError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : isPasswordChange ? (
                "Cambiar Contraseña"
              ) : (
                "Guardar Contraseña"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
