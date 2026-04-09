"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  User,
  Ghost,
  Trash2,
  Mail,
  AlertTriangle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createCollaborator,
  updateCollaborator,
  toggleCollaboratorActive,
  updateUserRole,
  assignUserToPartner,
  resendInvitation,
  deleteUser,
} from "@/actions/users";
import { useToast } from "@/components/shared/toast-provider";

interface UserPartnerRole {
  id: string;
  role: string;
  partner_id: string;
  partners: { id: string; name: string } | null;
}

interface AppUser {
  id: string;
  name: string;
  email: string | null;
  user_type: string;
  is_active: boolean;
  created_at: string;
  auth_user_id: string | null;
  user_partner_roles: UserPartnerRole[];
}

interface Partner {
  id: string;
  name: string;
}

interface UnassignedUser {
  id: string;
  name: string;
  email: string | null;
  created_at: string;
}

interface Props {
  initialUsers: AppUser[];
  partners: Partner[];
  unassignedUsers: UnassignedUser[];
  isSuperAdmin: boolean;
}

export function CollaboratorsClient({
  initialUsers,
  partners,
  unassignedUsers,
  isSuperAdmin,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState<string>("virtual_profile");
  const [skipInvite, setSkipInvite] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Resend loading state per user
  const [resendingFor, setResendingFor] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.set("userType", userType);
    if (skipInvite && userType === "system_user" && !editingUser) {
      formData.set("skipInvite", "true");
    }

    let result;

    if (editingUser) {
      result = await updateCollaborator(editingUser.id, formData);
    } else {
      result = await createCollaborator(formData);
    }

    setLoading(false);

    if (result.success) {
      const name = formData.get("name");
      const wasSkipped = skipInvite && userType === "system_user" && !editingUser;
      const emailWarn = result.data?.emailWarning;

      if (editingUser) {
        showToast(`Colaborador "${name}" actualizado`, "success");
      } else if (wasSkipped) {
        showToast(
          `Colaborador "${name}" creado sin invitacion. Usa el boton de correo para enviarla.`,
          "success"
        );
      } else if (emailWarn) {
        showToast(
          `Colaborador "${name}" creado, pero no se pudo enviar el email: ${emailWarn}. Puedes reenviar despues.`,
          "error"
        );
      } else {
        showToast(
          `Colaborador "${name}" creado. Se envio invitacion por email.`,
          "success"
        );
      }
      setDialogOpen(false);
      setEditingUser(null);
      setSkipInvite(false);
      router.refresh();
    } else {
      showToast(result.error ?? "Error desconocido", "error");
    }
  };

  const handleToggleActive = async (user: AppUser) => {
    const result = await toggleCollaboratorActive(user.id, !user.is_active);
    if (result.success) {
      showToast(
        user.is_active
          ? `"${user.name}" desactivado`
          : `"${user.name}" activado`,
        "success"
      );
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleRoleChange = async (
    userId: string,
    partnerId: string,
    newRole: string
  ) => {
    const result = await updateUserRole(
      userId,
      partnerId,
      newRole as "super_admin" | "admin" | "collaborator"
    );
    if (result.success) {
      showToast("Rol actualizado", "success");
      router.refresh();
    } else {
      showToast(result.error ?? "Error", "error");
    }
  };

  const handleResendInvitation = async (user: AppUser) => {
    setResendingFor(user.id);
    const result = await resendInvitation(user.id);
    setResendingFor(null);

    if (result.success) {
      showToast(
        `Invitacion reenviada a ${result.data?.email ?? user.email}`,
        "success"
      );
      router.refresh();
    } else {
      showToast(result.error ?? "Error al reenviar", "error");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    setDeleteLoading(true);
    const result = await deleteUser(userToDelete.id);
    setDeleteLoading(false);

    if (result.success) {
      showToast(`"${result.data?.name ?? userToDelete.name}" eliminado`, "success");
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      router.refresh();
    } else {
      showToast(result.error ?? "Error al eliminar", "error");
    }
  };

  const openEdit = (user: AppUser) => {
    setEditingUser(user);
    setUserType(user.user_type);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingUser(null);
    setUserType("virtual_profile");
    setSkipInvite(false);
    setDialogOpen(true);
  };

  const openDeleteDialog = (user: AppUser) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  // Assign unassigned user to a partner
  const handleAssign = async (userId: string, form: HTMLFormElement) => {
    const formData = new FormData(form);
    const partnerId = formData.get("assignPartnerId") as string;
    const role = (formData.get("assignRole") as string) || "collaborator";

    if (!partnerId) {
      showToast("Selecciona un partner", "error");
      return;
    }

    setLoading(true);
    const result = await assignUserToPartner(
      userId,
      partnerId,
      role as "super_admin" | "admin" | "collaborator"
    );
    setLoading(false);

    if (result.success) {
      showToast("Usuario asignado exitosamente", "success");
      router.refresh();
    } else {
      showToast(result.error ?? "Error al asignar", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Colaboradores</h1>
          <p className="text-muted-foreground">
            Gestiona los colaboradores y perfiles virtuales.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Colaborador
          </Button>

          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? "Editar Colaborador" : "Nuevo Colaborador"}
                </DialogTitle>
                <DialogDescription>
                  {editingUser
                    ? "Modifica los datos del colaborador."
                    : "Los perfiles virtuales son solo para contabilidad. Los usuarios del sistema pueden iniciar sesion."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {!editingUser && (
                  <div className="space-y-2">
                    <Label>Tipo de usuario</Label>
                    <Select value={userType} onValueChange={setUserType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="virtual_profile">
                          Perfil Virtual (solo contabilidad)
                        </SelectItem>
                        <SelectItem value="system_user">
                          Usuario del Sistema (con login)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Nombre completo"
                    defaultValue={editingUser?.name ?? ""}
                    required
                  />
                </div>

                {(userType === "system_user" || editingUser?.email) && (
                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Email{" "}
                      {userType === "system_user" && (
                        <span className="text-destructive">*</span>
                      )}
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="email@ejemplo.com"
                      defaultValue={editingUser?.email ?? ""}
                      required={userType === "system_user"}
                    />
                  </div>
                )}

                {!editingUser && (
                  <>
                    <div className="space-y-2">
                      <Label>Partner</Label>
                      <select
                        name="partnerId"
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Seleccionar Partner</option>
                        {partners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label>Rol</Label>
                      <select
                        name="role"
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="collaborator">Colaborador</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </div>

                    {/* Skip invite option for system_user */}
                    {userType === "system_user" && (
                      <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={skipInvite}
                            onChange={(e) => setSkipInvite(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-gray-300"
                          />
                          <div>
                            <p className="text-sm font-medium">
                              Crear sin enviar invitacion
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Crea la cuenta sin enviar email. Podras enviar la
                              invitacion despues con el boton de correo en la
                              tabla.{" "}
                              <span className="text-amber-600">
                                Util si el SMTP aun no esta configurado.
                              </span>
                            </p>
                          </div>
                        </label>
                      </div>
                    )}
                  </>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading
                    ? "Guardando..."
                    : editingUser
                    ? "Guardar Cambios"
                    : "Crear Colaborador"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Eliminar Usuario
            </DialogTitle>
            <DialogDescription>
              Esta accion no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {userToDelete && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-800">
                  Estas a punto de eliminar permanentemente a{" "}
                  <span className="font-semibold">{userToDelete.name}</span>
                  {userToDelete.email && (
                    <>
                      {" "}
                      (<span className="font-mono text-xs">{userToDelete.email}</span>)
                    </>
                  )}
                  .
                </p>
                <p className="text-sm text-red-700 mt-2">
                  Se eliminara su cuenta de autenticacion, sus asignaciones a
                  partners, y sus distribuciones en productos. Los reportes ya
                  generados no se veran afectados.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteLoading}
            >
              {deleteLoading ? "Eliminando..." : "Eliminar Permanentemente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {initialUsers.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
              <div className="text-center">
                <Users className="mx-auto h-10 w-10 mb-3" />
                <p className="font-medium">No hay colaboradores registrados</p>
                <p className="text-sm mt-1">
                  Agrega colaboradores con acceso al sistema o perfiles
                  virtuales.
                </p>
                <Button className="mt-4" onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Colaborador
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Colaboradores Registrados</CardTitle>
            <CardDescription>
              {initialUsers.length} colaborador
              {initialUsers.length !== 1 ? "es" : ""} en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">
                      Nombre
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      Email
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      Tipo
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      Partner / Rol
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      Estado
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {initialUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 font-medium">
                        <div className="flex items-center gap-2">
                          {user.user_type === "system_user" ? (
                            <User className="h-4 w-4 text-primary" />
                          ) : (
                            <Ghost className="h-4 w-4 text-muted-foreground" />
                          )}
                          {user.name}
                        </div>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {user.email || "—"}
                      </td>
                      <td className="py-3">
                        <Badge variant="outline">
                          {user.user_type === "system_user"
                            ? "Sistema"
                            : "Virtual"}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col gap-1">
                          {user.user_partner_roles.length > 0 ? (
                            user.user_partner_roles.map((upr) => (
                              <div
                                key={upr.id}
                                className="flex items-center gap-2"
                              >
                                <span className="text-xs text-muted-foreground">
                                  {(upr.partners as any)?.name ?? "—"}
                                </span>
                                <select
                                  value={upr.role}
                                  onChange={(e) =>
                                    handleRoleChange(
                                      user.id,
                                      upr.partner_id,
                                      e.target.value
                                    )
                                  }
                                  className="h-7 rounded border bg-background px-2 text-xs"
                                >
                                  <option value="collaborator">
                                    Colaborador
                                  </option>
                                  <option value="admin">Admin</option>
                                  <option value="super_admin">
                                    Super Admin
                                  </option>
                                </select>
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Sin partner asignado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={user.is_active ? "success" : "secondary"}
                        >
                          {user.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Resend invitation — only for system_user with auth */}
                          {isSuperAdmin &&
                            user.user_type === "system_user" &&
                            user.auth_user_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleResendInvitation(user)}
                                disabled={resendingFor === user.id}
                                title="Reenviar invitacion"
                              >
                                <Mail
                                  className={`h-4 w-4 text-blue-600 ${
                                    resendingFor === user.id
                                      ? "animate-pulse"
                                      : ""
                                  }`}
                                />
                              </Button>
                            )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(user)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(user)}
                            title={
                              user.is_active ? "Desactivar" : "Activar"
                            }
                          >
                            {user.is_active ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>

                          {/* Delete — only for super_admin */}
                          {isSuperAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(user)}
                              title="Eliminar usuario"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unassigned users — self-registered, waiting for partner assignment */}
      {unassignedUsers.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-600" />
              Usuarios sin Asignar
            </CardTitle>
            <CardDescription>
              Estos usuarios se registraron por su cuenta y estan esperando ser
              asignados a un Partner.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {unassignedUsers.map((user) => (
                <form
                  key={user.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAssign(user.id, e.currentTarget);
                  }}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-amber-100 bg-amber-50/50 p-3"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <User className="h-4 w-4 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email ?? "Sin email"} · Registrado{" "}
                        {new Date(user.created_at).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  <select
                    name="assignPartnerId"
                    required
                    className="h-8 rounded border bg-background px-2 text-xs"
                  >
                    <option value="">Partner...</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <select
                    name="assignRole"
                    className="h-8 rounded border bg-background px-2 text-xs"
                  >
                    <option value="collaborator">Colaborador</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>

                  <Button type="submit" size="sm" disabled={loading}>
                    Asignar
                  </Button>
                </form>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
