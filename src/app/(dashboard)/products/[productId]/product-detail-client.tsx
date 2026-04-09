"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle2,
  Ghost,
  User,
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
import { saveDistributions } from "@/actions/distributions";
import { useToast } from "@/components/shared/toast-provider";
import { cn, formatPercentage } from "@/lib/utils";

interface DistEntry {
  userId: string;
  userName: string;
  percentageShare: number;
}

interface AvailableUser {
  id: string;
  name: string;
  email: string | null;
  user_type: string;
}

interface Props {
  product: {
    id: string;
    name: string;
    description: string | null;
    partner_id: string;
    product_types: { id: string; name: string } | null;
    partners: { id: string; name: string } | null;
    product_distributions: {
      id: string;
      user_id: string;
      percentage_share: number;
      users: { id: string; name: string; email: string | null; user_type: string } | null;
    }[];
  };
  availableUsers: AvailableUser[];
}

export function ProductDetailClient({ product, availableUsers }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setSaving] = useState(false);

  // Initialize distributions from existing data
  const [distributions, setDistributions] = useState<DistEntry[]>(
    (product.product_distributions ?? []).map((d) => ({
      userId: d.user_id,
      userName: d.users?.name ?? "Desconocido",
      percentageShare: Number(d.percentage_share),
    }))
  );

  const totalPercentage = distributions.reduce(
    (sum, d) => sum + d.percentageShare,
    0
  );
  const roundedTotal = Math.round(totalPercentage * 100) / 100;
  const isValid = Math.abs(roundedTotal - 100) < 0.01;
  const remaining = Math.round((100 - roundedTotal) * 100) / 100;

  // Users not yet assigned
  const assignedIds = new Set(distributions.map((d) => d.userId));
  const unassignedUsers = availableUsers.filter((u) => !assignedIds.has(u.id));

  const addUser = (user: AvailableUser) => {
    setDistributions((prev) => [
      ...prev,
      {
        userId: user.id,
        userName: user.name,
        percentageShare: remaining > 0 ? Math.min(remaining, 100) : 0,
      },
    ]);
  };

  const removeUser = (userId: string) => {
    setDistributions((prev) => prev.filter((d) => d.userId !== userId));
  };

  const updatePercentage = (userId: string, value: number) => {
    setDistributions((prev) =>
      prev.map((d) =>
        d.userId === userId ? { ...d, percentageShare: value } : d
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await saveDistributions(
      product.id,
      distributions.map((d) => ({
        userId: d.userId,
        percentageShare: d.percentageShare,
      }))
    );
    setSaving(false);

    if (result.success) {
      showToast("Distribucion guardada correctamente", "success");
      router.refresh();
    } else {
      showToast(result.error ?? "Error al guardar", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/products">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
          <p className="text-muted-foreground">
            {product.partners?.name} — {product.product_types?.name}
            {product.description && ` — ${product.description}`}
          </p>
        </div>
      </div>

      {/* Distribution Editor */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Distribucion de Ganancias</CardTitle>
              <CardDescription>
                Asigna el porcentaje de ganancias para cada colaborador. Debe sumar exactamente 100%.
              </CardDescription>
            </div>
            <Button onClick={handleSave} disabled={loading || !isValid}>
              <Save className="mr-2 h-4 w-4" />
              {loading ? "Guardando..." : "Guardar Distribucion"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Status bar */}
          <div
            className={cn(
              "mb-6 flex items-center gap-3 rounded-lg border p-4",
              isValid
                ? "border-green-200 bg-green-50"
                : roundedTotal > 100
                ? "border-red-200 bg-red-50"
                : "border-amber-200 bg-amber-50"
            )}
          >
            {isValid ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle
                className={cn(
                  "h-5 w-5",
                  roundedTotal > 100 ? "text-red-600" : "text-amber-600"
                )}
              />
            )}
            <div className="flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  isValid
                    ? "text-green-800"
                    : roundedTotal > 100
                    ? "text-red-800"
                    : "text-amber-800"
                )}
              >
                {isValid
                  ? "Distribucion valida — Los porcentajes suman 100%"
                  : roundedTotal > 100
                  ? `Los porcentajes exceden el 100% (+${formatPercentage(roundedTotal - 100)})`
                  : distributions.length === 0
                  ? "Sin distribucion configurada — Agrega colaboradores"
                  : `Faltan ${formatPercentage(remaining)} para completar el 100%`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">
                {formatPercentage(roundedTotal)}
              </p>
              <p className="text-xs text-muted-foreground">de 100%</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-6 h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                isValid
                  ? "bg-green-500"
                  : roundedTotal > 100
                  ? "bg-red-500"
                  : "bg-amber-500"
              )}
              style={{ width: `${Math.min(roundedTotal, 100)}%` }}
            />
          </div>

          {/* Distribution entries */}
          {distributions.length > 0 && (
            <div className="space-y-3 mb-6">
              {distributions.map((dist, index) => {
                const userInfo = availableUsers.find(
                  (u) => u.id === dist.userId
                );
                return (
                  <div
                    key={dist.userId}
                    className="flex items-center gap-4 rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {userInfo?.user_type === "system_user" ? (
                        <User className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <Ghost className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{dist.userName}</p>
                        {userInfo?.email && (
                          <p className="text-xs text-muted-foreground truncate">
                            {userInfo.email}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0.01"
                        max="100"
                        step="0.01"
                        value={dist.percentageShare}
                        onChange={(e) =>
                          updatePercentage(
                            dist.userId,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-24 text-right"
                      />
                      <span className="text-sm text-muted-foreground w-4">%</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeUser(dist.userId)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add user */}
          {unassignedUsers.length > 0 && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Agregar colaborador</Label>
              <div className="flex flex-wrap gap-2">
                {unassignedUsers.map((user) => (
                  <Button
                    key={user.id}
                    variant="outline"
                    size="sm"
                    onClick={() => addUser(user)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {user.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {distributions.length === 0 && unassignedUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay colaboradores disponibles en este partner.</p>
              <p className="text-sm mt-1">
                <Link href="/collaborators" className="text-primary hover:underline">
                  Crea colaboradores primero
                </Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
