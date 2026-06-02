"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  SquaresFour,
  Package,
  Users,
  CreditCard,
  Wallet,
  ShieldCheck,
  Sparkle,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Confetti,
  Upload,
  BookOpen,
  Receipt,
} from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type OnboardingRole = "super_admin" | "admin" | "collaborator";

type Accent = "violet" | "blue" | "amber" | "emerald" | "rose" | "indigo";

interface OnboardingStep {
  icon: typeof Sparkle;
  eyebrow: string;
  title: string;
  subtitle: string;
  bullets: string[];
  cta?: { label: string; href: string };
  accent: Accent;
}

const accentStyles: Record<Accent, { bg: string; icon: string; ring: string; dot: string }> = {
  violet: {
    bg: "bg-violet-500/10 dark:bg-violet-400/10",
    icon: "text-violet-600 dark:text-violet-400",
    ring: "ring-violet-500/20",
    dot: "bg-violet-500",
  },
  blue: {
    bg: "bg-blue-500/10 dark:bg-blue-400/10",
    icon: "text-blue-600 dark:text-blue-400",
    ring: "ring-blue-500/20",
    dot: "bg-blue-500",
  },
  amber: {
    bg: "bg-amber-500/10 dark:bg-amber-400/10",
    icon: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/20",
    dot: "bg-amber-500",
  },
  emerald: {
    bg: "bg-emerald-500/10 dark:bg-emerald-400/10",
    icon: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/20",
    dot: "bg-emerald-500",
  },
  rose: {
    bg: "bg-rose-500/10 dark:bg-rose-400/10",
    icon: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/20",
    dot: "bg-rose-500",
  },
  indigo: {
    bg: "bg-indigo-500/10 dark:bg-indigo-400/10",
    icon: "text-indigo-600 dark:text-indigo-400",
    ring: "ring-indigo-500/20",
    dot: "bg-indigo-500",
  },
};

const adminSteps: OnboardingStep[] = [
  {
    icon: Sparkle,
    eyebrow: "Bienvenido",
    title: "Te damos la bienvenida a BoxBuild",
    subtitle:
      "Tu plataforma para gestionar ingresos, productos y pagos a colaboradores. Este recorrido toma menos de un minuto.",
    bullets: [
      "Sube reportes mensuales desde un CSV",
      "Define como se reparte cada producto",
      "Registra pagos y emite recibos en PDF",
    ],
    accent: "violet",
  },
  {
    icon: SquaresFour,
    eyebrow: "Paso 1",
    title: "El Dashboard es tu vista de control",
    subtitle:
      "Desde el inicio veras el resumen financiero del periodo: lo que entro, lo pendiente y lo ya pagado.",
    bullets: [
      "Cambia el rango con el selector (Mes, Trimestre, custom)",
      "Si manejas varios partners, alterna desde la barra superior",
      "Los 5 colaboradores con mas pendiente aparecen listos para pagar",
    ],
    cta: { label: "Ir al Dashboard", href: "/" },
    accent: "blue",
  },
  {
    icon: Upload,
    eyebrow: "Paso 2",
    title: "Sube un CSV y genera un reporte",
    subtitle:
      "El flujo principal: tomas el CSV de Microsoft Earnings y BoxBuild calcula la repartición por colaborador.",
    bullets: [
      "Elige partner, mes y tipo de cambio USD a MXN",
      "Arrastra el CSV — el sistema valida y resume",
      "Registra productos nuevos al vuelo si no existen",
    ],
    cta: { label: "Abrir Reportes", href: "/reports" },
    accent: "indigo",
  },
  {
    icon: Package,
    eyebrow: "Paso 3",
    title: "Productos y distribuciones",
    subtitle:
      "Cada producto necesita una distribucion que defina que porcentaje le toca a cada colaborador. La suma no puede exceder 100%.",
    bullets: [
      "Crea productos con nombre, tipo y partner",
      "Asigna colaboradores con su porcentaje en la pestaña Distribuciones",
      "Los cambios aplican a reportes futuros, no a los ya congelados",
    ],
    cta: { label: "Ver Productos", href: "/products" },
    accent: "emerald",
  },
  {
    icon: Users,
    eyebrow: "Paso 4",
    title: "Gestiona tu equipo",
    subtitle:
      "Crea colaboradores como usuarios reales (con login) o como perfiles virtuales (solo contables). Asigna roles y partners.",
    bullets: [
      "Roles disponibles: Colaborador, Admin, Super Admin",
      "Asigna usuarios pendientes desde la alerta amarilla",
      "Activa o desactiva en lote con la accion masiva",
    ],
    cta: { label: "Abrir Colaboradores", href: "/collaborators" },
    accent: "amber",
  },
  {
    icon: CreditCard,
    eyebrow: "Paso 5",
    title: "Registra pagos y emite recibos",
    subtitle:
      "Cuando llegue el momento de pagar, selecciona los items pendientes y BoxBuild genera el recibo en PDF automaticamente.",
    bullets: [
      "Agrega conceptos extras (bonos, deducciones, comisiones)",
      "Pago masivo para liquidar a varios colaboradores",
      "Recibos descargables disponibles en el historial",
    ],
    cta: { label: "Ir a Pagos", href: "/payments" },
    accent: "rose",
  },
  {
    icon: Confetti,
    eyebrow: "Listo",
    title: "Eso es todo lo basico",
    subtitle:
      "Encuentras guias detalladas en el Centro de Ayuda, accesible desde el menu lateral cuando lo necesites.",
    bullets: [
      "Activa la verificacion en dos pasos en Configuracion",
      "Revisa el registro de actividad para auditar cambios",
      "Cualquier duda: el Centro de Ayuda esta filtrado para tu rol",
    ],
    cta: { label: "Abrir Centro de Ayuda", href: "/help" },
    accent: "violet",
  },
];

const collaboratorSteps: OnboardingStep[] = [
  {
    icon: Sparkle,
    eyebrow: "Bienvenido",
    title: "Te damos la bienvenida a BoxBuild",
    subtitle:
      "Aqui puedes ver tus ganancias, productos asignados y descargar los recibos de tus pagos. Este recorrido toma menos de un minuto.",
    bullets: [
      "Consulta tus ganancias del mes y acumuladas",
      "Revisa los productos donde participas",
      "Descarga reportes y recibos en PDF",
    ],
    accent: "violet",
  },
  {
    icon: SquaresFour,
    eyebrow: "Paso 1",
    title: "Tu Dashboard personal",
    subtitle:
      "El inicio muestra cuanto llevas este mes (USD y MXN), tu acumulado historico y cuantos pagos has recibido.",
    bullets: [
      "Grafica con la tendencia de tus ultimos 12 meses",
      "Alerta cuando tengas comisiones o extras pendientes",
      "Lista de tus productos con el porcentaje asignado",
    ],
    cta: { label: "Ir a mi Dashboard", href: "/" },
    accent: "blue",
  },
  {
    icon: Wallet,
    eyebrow: "Paso 2",
    title: "Mis Ingresos: historial detallado",
    subtitle:
      "Aqui ves cada reporte donde aparecen tus ganancias, los ajustes que se aplicaron y los pagos recibidos.",
    bullets: [
      "Filtra por ano y por partner",
      "Cada linea te lleva al reporte completo",
      "Visualiza el desglose por producto",
    ],
    cta: { label: "Abrir Mis Ingresos", href: "/my-income" },
    accent: "emerald",
  },
  {
    icon: Package,
    eyebrow: "Paso 3",
    title: "Mis Productos",
    subtitle:
      "Lista de todos los productos donde tienes distribucion asignada. Si crees que falta alguno, contacta a tu administrador.",
    bullets: [
      "Ve el porcentaje que te corresponde en cada producto",
      "Identifica el estado: Activo, Borrador o Descontinuado",
      "Busca y filtra para encontrar rapido",
    ],
    cta: { label: "Ver mis Productos", href: "/products" },
    accent: "indigo",
  },
  {
    icon: Receipt,
    eyebrow: "Paso 4",
    title: "Reportes y recibos",
    subtitle:
      "Cuando te paguen, recibiras un recibo en PDF. Tambien puedes descargar los reportes mensuales donde apareces.",
    bullets: [
      "Reportes congelados: listos para pagar",
      "Recibos disponibles en el historial cuando recibes pagos",
      "Descarga en PDF o Excel desde el detalle del reporte",
    ],
    cta: { label: "Ver Reportes", href: "/reports" },
    accent: "amber",
  },
  {
    icon: ShieldCheck,
    eyebrow: "Paso 5",
    title: "Asegura tu cuenta",
    subtitle:
      "Activa la verificacion en dos pasos (2FA) para proteger tu cuenta y tu historial de pagos.",
    bullets: [
      "Vincula tu cuenta de Google para entrar mas rapido",
      "Activa 2FA con Google Authenticator o Authy",
      "Revisa tus sesiones activas en cualquier momento",
    ],
    cta: { label: "Ir a Configuracion", href: "/settings" },
    accent: "rose",
  },
  {
    icon: Confetti,
    eyebrow: "Listo",
    title: "Eso es todo",
    subtitle:
      "Cuando tengas dudas, el Centro de Ayuda esta filtrado para mostrarte solo lo que necesitas como colaborador.",
    bullets: [
      "Centro de Ayuda accesible desde el menu lateral",
      "Tu administrador asigna productos y registra pagos",
      "Cualquier ajuste a tus distribuciones se notifica por correo",
    ],
    cta: { label: "Abrir Centro de Ayuda", href: "/help" },
    accent: "violet",
  },
];

export function getOnboardingSteps(role: OnboardingRole): OnboardingStep[] {
  return role === "collaborator" ? collaboratorSteps : adminSteps;
}

interface OnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: OnboardingRole;
  userName?: string;
  onFinish?: () => void;
}

export function OnboardingDialog({
  open,
  onOpenChange,
  role,
  userName,
  onFinish,
}: OnboardingDialogProps) {
  const steps = useMemo(() => getOnboardingSteps(role), [role]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const step = steps[index];
  const total = steps.length;
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const accent = accentStyles[step.accent];
  const Icon = step.icon;

  const roleLabel =
    role === "super_admin"
      ? "Super Admin"
      : role === "admin"
        ? "Administrador"
        : "Colaborador";

  const handleNext = () => {
    if (isLast) {
      onFinish?.();
      onOpenChange(false);
    } else {
      setIndex((i) => Math.min(i + 1, total - 1));
    }
  };

  const handleBack = () => {
    setIndex((i) => Math.max(i - 1, 0));
  };

  const handleSkip = () => {
    onFinish?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 p-0 overflow-hidden">
        {/* Header — eyebrow + role + progress dots */}
        <div className="flex items-center justify-between px-6 pt-6">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              {step.eyebrow}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {roleLabel}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {index + 1} / {total}
          </p>
        </div>

        {/* Progress bar */}
        <div className="px-6 mt-4">
          <div className="flex gap-1.5">
            {steps.map((s, i) => {
              const dotAccent = accentStyles[s.accent].dot;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Ir al paso ${i + 1}`}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-all duration-300",
                    i < index && "bg-foreground/30",
                    i === index && cn(dotAccent),
                    i > index && "bg-muted"
                  )}
                />
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div
          key={index}
          className="px-6 pt-6 pb-2 animate-in fade-in-50 slide-in-from-right-2 duration-300"
        >
          {/* Icon */}
          <div
            className={cn(
              "mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ring-1",
              accent.bg,
              accent.ring
            )}
          >
            <Icon weight="duotone" className={cn("h-8 w-8", accent.icon)} />
          </div>

          {/* Title + subtitle */}
          <DialogTitle className="text-center text-xl font-semibold tracking-tight">
            {isFirst && userName
              ? `${step.title}, ${userName.split(" ")[0]}`
              : step.title}
          </DialogTitle>
          <DialogDescription className="text-center mt-2 text-sm leading-relaxed">
            {step.subtitle}
          </DialogDescription>

          {/* Bullets */}
          <ul className="mt-5 space-y-2">
            {step.bullets.map((b, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm text-foreground/85"
              >
                <CheckCircle
                  weight="fill"
                  className={cn("h-4 w-4 mt-0.5 shrink-0", accent.icon)}
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {/* CTA link */}
          {step.cta && (
            <div className="mt-5">
              <Link
                href={step.cta.href}
                onClick={handleSkip}
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:underline",
                  accent.icon
                )}
              >
                {step.cta.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Footer — navigation */}
        <div className="flex items-center justify-between gap-2 px-6 py-5 mt-2 border-t bg-muted/30">
          {!isLast ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              Saltar
            </Button>
          ) : (
            <Link
              href="/help"
              onClick={handleSkip}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Centro de Ayuda
            </Link>
          )}

          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Atras
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {isLast ? "Empezar" : "Siguiente"}
              {!isLast && <ArrowRight className="h-3.5 w-3.5 ml-1" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
