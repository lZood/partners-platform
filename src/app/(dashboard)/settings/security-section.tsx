"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Monitor,
  Smartphone,
  Laptop,
  Globe,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  setup2FA,
  verify2FA,
  disable2FA,
  terminateSession,
  terminateAllOtherSessions,
} from "@/actions/security";
import { useToast } from "@/components/shared/toast-provider";

interface LoginLog {
  id: string;
  email: string;
  ipAddress: string | null;
  userAgent: string | null;
  status: string;
  failureReason: string | null;
  createdAt: string;
}

interface Session {
  id: string;
  sessionToken: string;
  ipAddress: string | null;
  deviceInfo: string | null;
  userAgent: string | null;
  lastActiveAt: string;
  createdAt: string;
}

interface Props {
  totpEnabled: boolean;
  loginLogs: LoginLog[];
  sessions: Session[];
  currentSessionToken: string;
  userId: string;
}

const deviceIcons: Record<string, typeof Monitor> = {
  Windows: Laptop,
  Mac: Laptop,
  Linux: Laptop,
  Movil: Smartphone,
  Tablet: Smartphone,
  Desconocido: Globe,
};

export function SecuritySection({
  totpEnabled,
  loginLogs,
  sessions,
  currentSessionToken,
  userId,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [qrUri, setQrUri] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);

  const handleSetup2FA = async () => {
    setSaving(true);
    const result = await setup2FA();
    setSaving(false);
    if (result.success) {
      setQrUri(result.data.uri);
      setQrImage(result.data.qrCode);
      setSecretKey(result.data.secret);
      setSetupOpen(true);
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleVerify2FA = async () => {
    setSaving(true);
    const result = await verify2FA(totpCode);
    setSaving(false);
    if (result.success) {
      showToast("2FA activado exitosamente", "success");
      setSetupOpen(false);
      setTotpCode("");
      setRecoveryCodes(result.data?.recoveryCodes ?? []);
      setShowRecoveryCodes(true);
      router.refresh();
    } else {
      showToast(result.error ?? "Codigo incorrecto", "error");
    }
  };

  const handleDisable2FA = async () => {
    setSaving(true);
    const result = await disable2FA(totpCode);
    setSaving(false);
    if (result.success) {
      showToast("2FA desactivado", "success");
      setDisableOpen(false);
      setTotpCode("");
      router.refresh();
    } else {
      showToast(result.error ?? "Codigo incorrecto", "error");
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    const result = await terminateSession(sessionId);
    if (result.success) {
      showToast("Sesion cerrada", "success");
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleTerminateAll = async () => {
    if (!confirm("Cerrar todas las demas sesiones?")) return;
    const result = await terminateAllOtherSessions(userId, currentSessionToken);
    if (result.success) {
      showToast("Todas las demas sesiones cerradas", "success");
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Ahora";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div className="space-y-6">
      {/* 2FA */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Autenticacion en Dos Pasos (2FA)</CardTitle>
              <CardDescription>
                Agrega una capa extra de seguridad a tu cuenta.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {totpEnabled ? (
                <>
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-600">
                    Activado
                  </span>
                </>
              ) : (
                <>
                  <ShieldOff className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Desactivado
                  </span>
                </>
              )}
            </div>
            {totpEnabled ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTotpCode("");
                  setDisableOpen(true);
                }}
              >
                Desactivar 2FA
              </Button>
            ) : (
              <Button size="sm" onClick={handleSetup2FA} disabled={saving}>
                {saving ? "Configurando..." : "Activar 2FA"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2FA Setup Dialog */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar 2FA</DialogTitle>
            <DialogDescription>
              Escanea el codigo QR con Google Authenticator, Authy u otra app
              compatible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* QR Code */}
            <div className="rounded-lg bg-white p-4 text-center">
              {qrImage && (
                <img
                  src={qrImage}
                  alt="QR Code para 2FA"
                  className="mx-auto mb-3"
                  width={200}
                  height={200}
                />
              )}
              <p className="text-xs text-muted-foreground mb-2">
                Escanea el QR o copia la clave manualmente:
              </p>
              <code className="text-xs font-mono bg-muted px-3 py-1.5 rounded border select-all break-all">
                {secretKey}
              </code>
            </div>
            <div className="space-y-2">
              <Label>Codigo de verificacion</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={totpCode}
                onChange={(e) =>
                  setTotpCode(e.target.value.replace(/\D/g, ""))
                }
                className="text-center text-xl tracking-[0.3em] font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Ingresa el codigo de 6 digitos de tu app para confirmar.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetupOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleVerify2FA}
              disabled={saving || totpCode.length !== 6}
            >
              {saving ? "Verificando..." : "Activar 2FA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA Disable Dialog */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desactivar 2FA</DialogTitle>
            <DialogDescription>
              Ingresa un codigo de tu app para confirmar la desactivacion.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={totpCode}
              onChange={(e) =>
                setTotpCode(e.target.value.replace(/\D/g, ""))
              }
              className="text-center text-xl tracking-[0.3em] font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable2FA}
              disabled={saving || totpCode.length !== 6}
            >
              {saving ? "Desactivando..." : "Desactivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recovery Codes Dialog */}
      <Dialog open={showRecoveryCodes} onOpenChange={setShowRecoveryCodes}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Codigos de Respaldo</DialogTitle>
            <DialogDescription>
              Guarda estos codigos en un lugar seguro. Cada codigo solo puede
              usarse una vez si pierdes acceso a tu app de autenticacion.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4">
              {recoveryCodes.map((code, i) => (
                <code
                  key={i}
                  className="text-center font-mono text-sm py-1 bg-background rounded"
                >
                  {code}
                </code>
              ))}
            </div>
            <p className="text-xs text-destructive mt-3 text-center">
              Estos codigos no se mostraran de nuevo. Guardalos ahora.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                const text = recoveryCodes.join("\n");
                navigator.clipboard.writeText(text);
                showToast("Codigos copiados al portapapeles", "success");
              }}
            >
              Copiar Codigos
            </Button>
            <Button onClick={() => setShowRecoveryCodes(false)}>
              Ya los guarde
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Active Sessions */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Sesiones Activas</CardTitle>
              <CardDescription>
                Dispositivos donde has iniciado sesion.
              </CardDescription>
            </div>
            {sessions.length > 1 && (
              <Button variant="outline" size="sm" onClick={handleTerminateAll}>
                Cerrar otras sesiones
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sessions.map((session) => {
              const DeviceIcon =
                deviceIcons[session.deviceInfo ?? "Desconocido"] ?? Globe;
              const isCurrent =
                session.sessionToken === currentSessionToken;
              return (
                <div
                  key={session.id}
                  className={`flex items-center gap-3 rounded-lg p-3 ${
                    isCurrent ? "bg-primary/5 ring-1 ring-primary/20" : "bg-muted/30"
                  }`}
                >
                  <DeviceIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {session.deviceInfo ?? "Dispositivo"}
                      </p>
                      {isCurrent && (
                        <Badge variant="success" className="text-[10px]">
                          Esta sesion
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {session.ipAddress ?? "IP desconocida"} · Ultima
                      actividad: {timeAgo(session.lastActiveAt)}
                    </p>
                  </div>
                  {!isCurrent && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                      onClick={() => handleTerminateSession(session.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
            {sessions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay sesiones activas registradas
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Login History */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Historial de Accesos</CardTitle>
          <CardDescription>Ultimos intentos de inicio de sesion.</CardDescription>
        </CardHeader>
        <CardContent>
          {loginLogs.length > 0 ? (
            <div className="space-y-2">
              {loginLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 rounded-lg p-3 bg-muted/30"
                >
                  {log.status === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">
                        {log.status === "success" ? "Acceso exitoso" : "Acceso fallido"}
                      </span>
                      {log.failureReason && (
                        <span className="text-muted-foreground">
                          {" "}
                          — {log.failureReason}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {log.ipAddress ?? "IP desconocida"} ·{" "}
                      {formatDate(log.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay registros de acceso
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
