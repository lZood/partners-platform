"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { User, Building2, Save, Camera, Link2, Unlink, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
import { updatePartner } from "@/actions/partners";
import { updateUserProfile, updateUserAvatar } from "@/actions/users";
import { uploadFile, getFileExtension } from "@/lib/supabase/storage";
import { useToast } from "@/components/shared/toast-provider";
import { getInitials } from "@/lib/utils";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

interface Props {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  userRole: string;
  partner: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  googleLinked: boolean;
  googleEmail: string | null;
  googleAvatar: string | null;
}

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  collaborator: "Colaborador",
};

export function SettingsClient({ user, userRole, partner, googleLinked, googleEmail, googleAvatar }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();
  const [savingUser, setSavingUser] = useState(false);
  const [savingPartner, setSavingPartner] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [unlinkingGoogle, setUnlinkingGoogle] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user.avatarUrl
  );
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const canEditPartner = userRole === "super_admin" || userRole === "admin";

  const initials = getInitials(user.name);

  const handleAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview immediately
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload
    setUploadingAvatar(true);
    const ext = getFileExtension(file);
    const path = `${user.id}.${ext}`;
    const result = await uploadFile("avatars", path, file);

    if ("error" in result) {
      showToast(result.error, "error");
      setAvatarPreview(user.avatarUrl);
      setUploadingAvatar(false);
      return;
    }

    // Save URL to DB
    const saveResult = await updateUserAvatar(result.url);
    setUploadingAvatar(false);

    if (saveResult.success) {
      showToast("Foto actualizada", "success");
      router.refresh();
    } else {
      showToast(saveResult.error ?? "Error", "error");
    }
  };

  const handleUserSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingUser(true);
    const formData = new FormData(e.currentTarget);
    const result = await updateUserProfile(formData);
    setSavingUser(false);
    if (result.success) {
      showToast("Perfil actualizado", "success");
      router.refresh();
    } else {
      showToast(result.error ?? "Error al guardar", "error");
    }
  };

  const handleLinkGoogle = async () => {
    setLinkingGoogle(true);
    const redirectBase =
      process.env.NEXT_PUBLIC_APP_URL ||
      window.location.origin.replace("0.0.0.0", "localhost");

    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: `${redirectBase}/auth/callback?next=/settings`,
      },
    });

    if (error) {
      showToast(error.message || "Error al vincular Google", "error");
      setLinkingGoogle(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    setUnlinkingGoogle(true);

    const { data: { user: authUser } } = await supabase.auth.getUser();
    const googleIdentity = authUser?.identities?.find(
      (i) => i.provider === "google"
    );

    if (!googleIdentity) {
      showToast("No se encontro la cuenta de Google vinculada", "error");
      setUnlinkingGoogle(false);
      return;
    }

    const { error } = await supabase.auth.unlinkIdentity(googleIdentity);

    if (error) {
      showToast(error.message || "Error al desvincular Google", "error");
      setUnlinkingGoogle(false);
      return;
    }

    showToast("Cuenta de Google desvinculada", "success");
    setUnlinkingGoogle(false);
    router.refresh();
  };

  const handlePartnerSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!partner) return;
    setSavingPartner(true);
    const formData = new FormData(e.currentTarget);
    const result = await updatePartner(partner.id, formData);
    setSavingPartner(false);
    if (result.success) {
      showToast("Partner actualizado", "success");
      router.refresh();
    } else {
      showToast(result.error ?? "Error al guardar", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuracion</h1>
        <p className="text-muted-foreground">
          Administra tu perfil y los datos del partner.
        </p>
      </div>

      {/* User Profile */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Mi Perfil</CardTitle>
              <CardDescription>Tu informacion personal.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Avatar upload */}
          <div className="flex items-center gap-5 mb-6">
            <div className="relative group">
              <div className="h-20 w-20 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt={user.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-primary">
                    {initials}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera className="h-5 w-5 text-white" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <p className="text-sm font-medium">Foto de perfil</p>
              <p className="text-xs text-muted-foreground">
                {uploadingAvatar
                  ? "Subiendo..."
                  : "Click en la imagen para cambiar"}
              </p>
            </div>
          </div>

          <form onSubmit={handleUserSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="userName">Nombre</Label>
                <Input
                  id="userName"
                  name="name"
                  defaultValue={user.name}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userEmail">Email</Label>
                <Input
                  id="userEmail"
                  value={user.email}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rol:</span>
                <Badge variant="outline">
                  {roleLabels[userRole] ?? userRole}
                </Badge>
              </div>
              <Button type="submit" disabled={savingUser}>
                <Save className="mr-2 h-4 w-4" />
                {savingUser ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>

          {/* Google Account Section */}
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-medium mb-3">Cuenta vinculada</h3>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <GoogleIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Google</p>
                    {googleLinked && (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Vinculada
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {googleLinked
                      ? googleEmail ?? "Cuenta vinculada"
                      : "No vinculada — vincula tu cuenta para iniciar sesion con Google"}
                  </p>
                </div>
              </div>

              {googleLinked ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnlinkGoogle}
                  disabled={unlinkingGoogle}
                  className="text-destructive hover:text-destructive"
                >
                  <Unlink className="mr-1.5 h-3.5 w-3.5" />
                  {unlinkingGoogle ? "Desvinculando..." : "Desvincular"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLinkGoogle}
                  disabled={linkingGoogle}
                >
                  <Link2 className="mr-1.5 h-3.5 w-3.5" />
                  {linkingGoogle ? "Redirigiendo..." : "Vincular"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Partner Profile */}
      {canEditPartner && partner && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Datos del Partner</CardTitle>
                <CardDescription>
                  Informacion general de {partner.name}.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePartnerSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="partnerName">Nombre</Label>
                  <Input
                    id="partnerName"
                    name="name"
                    defaultValue={partner.name}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partnerDescription">Descripcion</Label>
                  <Input
                    id="partnerDescription"
                    name="description"
                    defaultValue={partner.description ?? ""}
                    placeholder="Descripcion del partner"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={savingPartner}>
                  <Save className="mr-2 h-4 w-4" />
                  {savingPartner ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
