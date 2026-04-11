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
  Shield,
  ArrowLeft,
} from "lucide-react";
import { activateCurrentUser } from "@/actions/users";
import {
  check2FAEnabled,
  validate2FALogin,
  validateRecoveryCode,
} from "@/actions/security";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PageState = "loading" | "error" | "2fa" | "form" | "success";

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
  const [userEmail, setUserEmail] = useState("");
  const [isPasswordChange, setIsPasswordChange] = useState(false);

  // 2FA state
  const [totpCode, setTotpCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [twoFAError, setTwoFAError] = useState("");

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
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      if (accessToken && refreshToken) {
        supabase.auth
          .setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          .then(() => checkSession())
          .catch(() => checkSession());
        return;
      }
      if (accessToken) {
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
          "No se encontro una sesion activa. Esto puede suceder si el enlace ha expirado o ya fue utilizado.",
      });
      setPageState("error");
      return;
    }

    const confirmedAt = user.confirmed_at;
    const lastSignIn = user.last_sign_in_at;
    const email = user.email ?? "";

    setUserEmail(email);

    if (user.user_metadata?.name) {
      setUserName(user.user_metadata.name);
    }

    // If user has signed in before, it's a password change (recovery)
    if (lastSignIn && confirmedAt && lastSignIn !== confirmedAt) {
      setIsPasswordChange(true);

      // Check if user has 2FA — require verification before allowing password change
      if (email) {
        const has2FA = await check2FAEnabled(email);
        if (has2FA) {
          setPageState("2fa");
          return;
        }
      }
    }

    setPageState("form");
  }

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFAError("");
    setLoading(true);

    let result;
    if (useRecoveryCode) {
      result = await validateRecoveryCode(userEmail, recoveryCode);
    } else {
      result = await validate2FALogin(userEmail, totpCode);
    }

    setLoading(false);

    if (!result.success) {
      setTwoFAError(result.error ?? "Codigo incorrecto");
      return;
    }

    // 2FA verified — proceed to password form
    setPageState("form");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (password.length < 6) {
      setFormError("La contrasena debe tener al menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Las contrasenas no coinciden");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      const msg = translateAuthError(updateError.message);
      setFormError(msg);
      return;
    }

    // Activate the user in the users table (invited users start as inactive)
    await activateCurrentUser();

    setPageState("success");

    setTimeout(async () => {
      if (isPasswordChange) {
        await supabase.auth.signOut({ scope: "global" });
        window.location.href = "/login";
      } else {
        window.location.href = "/";
      }
    }, 2000);
  };

  // ── Helpers ────────────────────────────────────────────────────────

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
        return "El enlace ha expirado. Si es una invitacion, pide a tu administrador que reenvie la invitacion. Si es recuperacion de contrasena, solicita un nuevo enlace.";
      case "access_denied":
        return "No se pudo verificar tu identidad. El enlace pudo haber sido usado anteriormente o haber expirado.";
      case "no_session":
        return "No hay una sesion activa. Intenta hacer clic en el enlace nuevamente desde tu correo.";
      default:
        return "Intenta de nuevo o contacta a tu administrador.";
    }
  }

  function translateAuthError(msg: string): string {
    if (msg.includes("Auth session missing")) {
      return "Tu sesion ha expirado. Solicita un nuevo enlace.";
    }
    if (msg.includes("same_password")) {
      return "La nueva contrasena debe ser diferente a la actual.";
    }
    if (msg.includes("weak_password")) {
      return "La contrasena es demasiado debil. Usa al menos 6 caracteres.";
    }
    return msg;
  }

  // ── Render: Loading ───────────────────────────────────────────────

  if (pageState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
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
      <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>{getErrorTitle(hashError.code)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-destructive/10 p-4">
              <p className="text-sm text-destructive">
                {hashError.description}
              </p>
            </div>

            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                {getErrorAdvice(hashError.code)}
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/login")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Ir al inicio de sesion
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // ── Render: 2FA Verification ─────────────────────────────────────

  if (pageState === "2fa") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">
              Verificacion en Dos Pasos
            </CardTitle>
            <CardDescription>
              {useRecoveryCode
                ? "Ingresa uno de tus codigos de respaldo para continuar"
                : "Ingresa el codigo de tu aplicacion de autenticacion para cambiar tu contrasena"}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handle2FAVerify}>
            <CardContent className="space-y-4">
              {twoFAError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {twoFAError}
                </div>
              )}

              {useRecoveryCode ? (
                <div className="space-y-2">
                  <Label htmlFor="recovery">Codigo de respaldo</Label>
                  <Input
                    id="recovery"
                    type="text"
                    placeholder="XXXX-XXXX"
                    value={recoveryCode}
                    onChange={(e) =>
                      setRecoveryCode(e.target.value.toUpperCase())
                    }
                    className="text-center text-xl tracking-wider font-mono"
                    autoFocus
                    required
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Cada codigo solo se puede usar una vez.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="totp">Codigo de 6 digitos</Label>
                  <Input
                    id="totp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={totpCode}
                    onChange={(e) =>
                      setTotpCode(e.target.value.replace(/\D/g, ""))
                    }
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                    autoFocus
                    required
                  />
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full"
                disabled={
                  loading ||
                  (useRecoveryCode
                    ? recoveryCode.length < 4
                    : totpCode.length !== 6)
                }
              >
                {loading ? "Verificando..." : "Verificar y continuar"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setUseRecoveryCode(!useRecoveryCode);
                  setTwoFAError("");
                  setTotpCode("");
                  setRecoveryCode("");
                }}
                className="text-sm text-primary hover:underline"
              >
                {useRecoveryCode
                  ? "Usar codigo de autenticacion"
                  : "Usar codigo de respaldo"}
              </button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  // ── Render: Success ───────────────────────────────────────────────

  if (pageState === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-bold">
                {isPasswordChange
                  ? "Contrasena actualizada"
                  : "Contrasena configurada"}
              </h2>
              <p className="text-muted-foreground">
                {isPasswordChange
                  ? "Tu contrasena ha sido cambiada exitosamente. Redirigiendo al login..."
                  : "Tu cuenta esta lista. Redirigiendo al dashboard..."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render: Password Form ────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            {isPasswordChange ? (
              <KeyRound className="h-6 w-6" />
            ) : (
              <Lock className="h-6 w-6" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isPasswordChange
              ? "Restablecer Contrasena"
              : "Configura tu Contrasena"}
          </CardTitle>
          <CardDescription>
            {isPasswordChange ? (
              userName ? (
                <>
                  Hola, <span className="font-medium">{userName}</span>. Ingresa
                  tu nueva contrasena.
                </>
              ) : (
                "Ingresa tu nueva contrasena."
              )
            ) : userName ? (
              <>
                Bienvenido, <span className="font-medium">{userName}</span>.
                Crea una contrasena para acceder a la plataforma.
              </>
            ) : (
              "Crea una contrasena para acceder a la plataforma."
            )}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {formError && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">
                {isPasswordChange ? "Nueva contrasena" : "Contrasena"}
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
                {isPasswordChange ? "nueva contrasena" : "contrasena"}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repite tu contrasena"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : isPasswordChange ? (
                "Restablecer Contrasena"
              ) : (
                "Guardar Contrasena"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
