/**
 * Product health scoring and revenue forecasting.
 *
 * Inputs are monthly revenue time series (oldest → newest). Minecraft
 * marketplace products typically follow an exponential decay curve after
 * launch, so we fit a simple decay model and use the momentum of the last
 * few months to classify health.
 */

export type HealthStatus =
  | "new"           // < 2 months of data
  | "trending"      // > +15% MoM sustained
  | "stable"        // within ±15% MoM
  | "declining"     // -15% to -40% MoM
  | "at_risk"       // < -40% MoM or 2+ months of decline
  | "dormant";      // no revenue for 2+ months

export interface ProductHealth {
  status: HealthStatus;
  label: string;
  color: "emerald" | "blue" | "amber" | "orange" | "red" | "gray";
  momPct: number | null;       // last month vs previous month, signed %
  trend3moPct: number | null;  // last 3 months vs previous 3 months
  reasoning: string;
}

export interface ProductForecast {
  model: "decay" | "moving_avg" | "insufficient_data";
  decayRate: number | null;        // monthly retention factor (0..1, e.g. 0.85 = keeps 85% MoM)
  confidence: "low" | "medium" | "high";
  next3MonthsUsd: number;
  next6MonthsUsd: number;
  next12MonthsUsd: number;
  projection: { month: string; label: string; projectedUsd: number }[];
}

interface MonthlyEntry {
  month: string;    // YYYY-MM
  label: string;
  grossUsd: number;
}

const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function nextMonth(yyyyMm: string): string {
  const [yStr, mStr] = yyyyMm.split("-");
  let y = parseInt(yStr);
  let m = parseInt(mStr) + 1;
  if (m > 12) { m = 1; y += 1; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

function labelFor(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-");
  return `${MONTH_LABELS[parseInt(m) - 1]} ${y}`;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ─── Health score ───────────────────────────────────────────────────

export function computeHealth(monthly: MonthlyEntry[]): ProductHealth {
  const n = monthly.length;

  if (n === 0) {
    return {
      status: "new",
      label: "Sin datos",
      color: "gray",
      momPct: null,
      trend3moPct: null,
      reasoning: "Este producto aun no aparece en ningun reporte.",
    };
  }

  const last = monthly[n - 1];
  const prev = n >= 2 ? monthly[n - 2] : null;

  // Dormant: last 2 months zero
  if (n >= 2 && monthly[n - 1].grossUsd === 0 && monthly[n - 2].grossUsd === 0) {
    return {
      status: "dormant",
      label: "Dormido",
      color: "gray",
      momPct: 0,
      trend3moPct: null,
      reasoning: "Sin ingresos reportados en los ultimos 2 meses.",
    };
  }

  if (n < 2) {
    return {
      status: "new",
      label: "Nuevo",
      color: "blue",
      momPct: null,
      trend3moPct: null,
      reasoning: "Solo un mes de datos — aun muy temprano para evaluar.",
    };
  }

  // MoM %
  const momPct = prev && prev.grossUsd > 0
    ? ((last.grossUsd - prev.grossUsd) / prev.grossUsd) * 100
    : null;

  // 3mo vs prior 3mo
  let trend3moPct: number | null = null;
  if (n >= 6) {
    const recent3 = mean(monthly.slice(-3).map((m) => m.grossUsd));
    const prior3 = mean(monthly.slice(-6, -3).map((m) => m.grossUsd));
    if (prior3 > 0) {
      trend3moPct = ((recent3 - prior3) / prior3) * 100;
    }
  }

  // Classification — favor the 3-month trend when available, fall back to MoM
  const primary = trend3moPct ?? momPct ?? 0;

  if (primary >= 15) {
    return {
      status: "trending",
      label: "En crecimiento",
      color: "emerald",
      momPct,
      trend3moPct,
      reasoning:
        trend3moPct !== null
          ? `Ingresos crecieron ${trend3moPct.toFixed(0)}% vs el trimestre anterior.`
          : `Ingresos subieron ${momPct!.toFixed(0)}% vs el mes anterior.`,
    };
  }

  if (primary <= -40) {
    return {
      status: "at_risk",
      label: "En riesgo",
      color: "red",
      momPct,
      trend3moPct,
      reasoning:
        trend3moPct !== null
          ? `Caida de ${Math.abs(trend3moPct).toFixed(0)}% vs el trimestre anterior — considera actualizar o retirar.`
          : `Caida fuerte de ${Math.abs(momPct!).toFixed(0)}% MoM.`,
    };
  }

  if (primary <= -15) {
    return {
      status: "declining",
      label: "En declive",
      color: "orange",
      momPct,
      trend3moPct,
      reasoning:
        trend3moPct !== null
          ? `Ingresos bajaron ${Math.abs(trend3moPct).toFixed(0)}% vs el trimestre anterior.`
          : `Ingresos bajaron ${Math.abs(momPct!).toFixed(0)}% MoM.`,
    };
  }

  return {
    status: "stable",
    label: "Estable",
    color: "blue",
    momPct,
    trend3moPct,
    reasoning:
      momPct !== null
        ? `Variacion mensual dentro del rango normal (${momPct.toFixed(0)}% MoM).`
        : "Ingresos dentro del rango normal.",
  };
}

/**
 * Compute health from a raw trend array (e.g. last N months of gross USD,
 * oldest → newest). Useful for the products list where we only have
 * the sparkline data.
 */
export function computeHealthFromTrend(trend: number[]): ProductHealth {
  const monthly = trend.map((v, i) => ({
    month: `2000-${String((i % 12) + 1).padStart(2, "0")}`,
    label: "",
    grossUsd: v,
  }));
  return computeHealth(monthly);
}

// ─── Forecast (exponential decay fit + fallback to moving avg) ─────

export function computeForecast(monthly: MonthlyEntry[]): ProductForecast {
  const n = monthly.length;
  const emptyProjection = {
    next3MonthsUsd: 0,
    next6MonthsUsd: 0,
    next12MonthsUsd: 0,
    projection: [] as { month: string; label: string; projectedUsd: number }[],
  };

  if (n === 0) {
    return {
      model: "insufficient_data",
      decayRate: null,
      confidence: "low",
      ...emptyProjection,
    };
  }

  const lastMonth = monthly[n - 1].month;
  const lastValue = monthly[n - 1].grossUsd;

  // Under 3 months of data → use current month as constant estimate
  if (n < 3) {
    const projection: { month: string; label: string; projectedUsd: number }[] = [];
    let cursor = lastMonth;
    for (let i = 0; i < 12; i++) {
      cursor = nextMonth(cursor);
      projection.push({
        month: cursor,
        label: labelFor(cursor),
        projectedUsd: Math.round(lastValue * 100) / 100,
      });
    }
    const sum = (k: number) =>
      Math.round(projection.slice(0, k).reduce((a, p) => a + p.projectedUsd, 0) * 100) / 100;
    return {
      model: "moving_avg",
      decayRate: null,
      confidence: "low",
      next3MonthsUsd: sum(3),
      next6MonthsUsd: sum(6),
      next12MonthsUsd: sum(12),
      projection,
    };
  }

  // Estimate decay rate: ratio of last 3 months to prior 3 months (if available),
  // else last 2 months to prior 2, else last vs prev.
  let decayRate: number;
  let confidence: "low" | "medium" | "high";

  if (n >= 6) {
    const recent3 = mean(monthly.slice(-3).map((m) => m.grossUsd));
    const prior3 = mean(monthly.slice(-6, -3).map((m) => m.grossUsd));
    // decay per 3-month window → convert to monthly
    if (prior3 > 0) {
      const windowRatio = recent3 / prior3;
      decayRate = Math.pow(Math.max(windowRatio, 0.01), 1 / 3);
      confidence = n >= 12 ? "high" : "medium";
    } else {
      decayRate = 1;
      confidence = "low";
    }
  } else {
    const recent = mean(monthly.slice(-2).map((m) => m.grossUsd));
    const prior = monthly[0].grossUsd;
    decayRate =
      prior > 0 ? Math.pow(Math.max(recent / prior, 0.01), 1 / (n - 1)) : 1;
    confidence = "low";
  }

  // Clamp: decay can't exceed 1.3 (150% MoM growth is unrealistic to project)
  // and floor at 0.4 (won't predict >60% monthly drop indefinitely)
  decayRate = Math.max(0.4, Math.min(1.3, decayRate));

  const projection: { month: string; label: string; projectedUsd: number }[] = [];
  let cursor = lastMonth;
  let currentValue = Math.max(lastValue, 0);

  for (let i = 0; i < 12; i++) {
    cursor = nextMonth(cursor);
    currentValue = currentValue * decayRate;
    projection.push({
      month: cursor,
      label: labelFor(cursor),
      projectedUsd: Math.round(Math.max(currentValue, 0) * 100) / 100,
    });
  }

  const sum = (k: number) =>
    Math.round(projection.slice(0, k).reduce((a, p) => a + p.projectedUsd, 0) * 100) / 100;

  return {
    model: "decay",
    decayRate: Math.round(decayRate * 1000) / 1000,
    confidence,
    next3MonthsUsd: sum(3),
    next6MonthsUsd: sum(6),
    next12MonthsUsd: sum(12),
    projection,
  };
}
