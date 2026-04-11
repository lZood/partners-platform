"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  check2FAEnabled,
  validate2FALogin,
  validateRecoveryCode,
  logLoginAttempt,
  createSession,
} from "@/actions/security";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [googleLoading, setGoogleLoading] = useState(false);

  // 2FA state
  const [needs2FA, setNeeds2FA] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  const getClientInfo = () => {
    const userAgent =
      typeof navigator !== "undefined" ? navigator.userAgent : null;
    return { userAgent, ipAddress: null }; // IP captured server-side
  };

  const completeLogin = async () => {
    const { userAgent } = getClientInfo();

    // Log and create session (non-blocking, don't let failures prevent login)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Run both in parallel, don't await individually
      const promises: Promise<any>[] = [
        logLoginAttempt({
          email,
          ipAddress: null,
          userAgent,
          status: "success",
        }),
      ];

      if (session) {
        const { data: appUser } = await supabase
          .from("users")
          .select("id")
          .eq("email", email)
          .single();
        if (appUser) {
          promises.push(
            createSession({
              userId: (appUser as any).id,
              sessionToken: session.access_token.substring(0, 32),
              ipAddress: null,
              userAgent,
            })
          );
        }
      }

      await Promise.allSettled(promises);
    } catch {
      // Non-critical — don't block login
    }

    router.push("/");
    router.refresh();
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");

    const { error: googleError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (googleError) {
      setError("Error al iniciar sesion con Google");
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { userAgent } = getClientInfo();

    // Check if user has 2FA enabled before signing in
    const has2FA = await check2FAEnabled(email);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      logLoginAttempt({
        email,
        ipAddress: null,
        userAgent,
        status: "failed",
        failureReason: "Credenciales incorrectas",
      }).catch(() => {});
      setError("Credenciales incorrectas. Verifica tu email y contrasena.");
      setLoading(false);
      return;
    }

    if (has2FA) {
      // Don't complete login yet — show 2FA screen
      // Sign out temporarily until 2FA is verified
      await supabase.auth.signOut();
      setNeeds2FA(true);
      setLoading(false);
      return;
    }

    // No 2FA — complete login
    await completeLogin();
  };

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    let result;
    if (useRecoveryCode) {
      result = await validateRecoveryCode(email, recoveryCode);
    } else {
      result = await validate2FALogin(email, totpCode);
    }

    if (!result.success) {
      setError(result.error ?? "Codigo incorrecto");
      setLoading(false);
      return;
    }

    // Re-sign in after 2FA verification
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Error al completar el login");
      setLoading(false);
      return;
    }

    await completeLogin();
  };

  // ── 2FA Verification Screen ──
  if (needs2FA) {
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
                ? "Ingresa uno de tus codigos de respaldo"
                : "Ingresa el codigo de tu aplicacion de autenticacion"}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handle2FAVerify}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {useRecoveryCode ? (
                <div className="space-y-2">
                  <label htmlFor="recovery" className="text-sm font-medium">
                    Codigo de respaldo
                  </label>
                  <Input
                    id="recovery"
                    type="text"
                    placeholder="XXXX-XXXX"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
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
                  <label htmlFor="totp" className="text-sm font-medium">
                    Codigo de 6 digitos
                  </label>
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
                {loading ? "Verificando..." : "Verificar"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setUseRecoveryCode(!useRecoveryCode);
                  setError("");
                  setTotpCode("");
                  setRecoveryCode("");
                }}
                className="text-sm text-primary hover:underline"
              >
                {useRecoveryCode
                  ? "Usar codigo de autenticacion"
                  : "Usar codigo de respaldo"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNeeds2FA(false);
                  setTotpCode("");
                  setRecoveryCode("");
                  setUseRecoveryCode(false);
                  setError("");
                }}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Volver al login
              </button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  // ── Normal Login Screen ──
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xl font-bold">
            B
          </div>
          <CardTitle className="text-2xl">BoxFi Partners</CardTitle>
          <CardDescription>
            Inicia sesion para acceder al panel de gestion
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
            >
              <GoogleIcon className="h-5 w-5 mr-2" />
              {googleLoading ? "Redirigiendo..." : "Continuar con Google"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">o</span>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Contrasena
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Tu contrasena"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Iniciando sesion..." : "Iniciar sesion"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              No tienes cuenta?{" "}
              <Link href="/register" className="text-primary hover:underline">
                Solicitar acceso
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
