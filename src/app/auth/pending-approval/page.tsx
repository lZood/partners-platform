"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Clock, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PendingApprovalPage() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: "global" });
    window.location.href = "/login";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <Clock className="h-7 w-7 text-amber-600" />
          </div>
          <CardTitle className="text-xl">Cuenta Pendiente de Aprobacion</CardTitle>
          <CardDescription className="text-base mt-1">
            Tu registro fue recibido exitosamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Un administrador debe aprobar tu acceso
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Tu cuenta ha sido creada pero aun no tienes acceso al sistema.
                  Un administrador revisara tu solicitud y te asignara a un
                  Partner con el rol correspondiente.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              Una vez que seas aprobado, podras iniciar sesion normalmente con tu
              email y contraseña. Si tienes dudas, contacta al administrador de
              tu organizacion.
            </p>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar sesion
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
