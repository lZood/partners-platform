"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { User, Building2, Save, Camera } from "lucide-react";
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
}

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  collaborator: "Colaborador",
};

export function SettingsClient({ user, userRole, partner }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [savingUser, setSavingUser] = useState(false);
  const [savingPartner, setSavingPartner] = useState(false);
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
