import { z } from "zod";

// Partner
export const partnerSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(255),
  description: z.string().optional(),
});

// Product
export const productSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(255),
  partnerId: z.string().uuid(),
  productTypeId: z.string().uuid(),
  description: z.string().optional(),
});

// Distribution entry
export const distributionEntrySchema = z.object({
  userId: z.string().uuid(),
  percentageShare: z
    .number()
    .min(0.01, "El porcentaje debe ser mayor a 0")
    .max(100, "El porcentaje no puede exceder 100%"),
});

// Full product distribution (must sum to 100)
export const productDistributionSchema = z
  .array(distributionEntrySchema)
  .refine(
    (entries) => {
      const total = entries.reduce((sum, e) => sum + e.percentageShare, 0);
      return Math.abs(total - 100) < 0.01; // tolerance for floating point
    },
    {
      message: "Los porcentajes deben sumar exactamente 100%",
    }
  );

// Tax
export const taxSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(255),
  partnerId: z.string().uuid(),
  percentageRate: z
    .number()
    .min(0, "La tasa no puede ser negativa")
    .max(100, "La tasa no puede exceder 100%"),
  priorityOrder: z.number().int().min(1),
  description: z.string().optional(),
});

// Exchange rate
export const exchangeRateSchema = z.object({
  partnerId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}-01$/, "Formato: YYYY-MM-01"),
  usdToMxn: z.number().positive("El tipo de cambio debe ser positivo"),
  notes: z.string().optional(),
});

// Adjustment
export const adjustmentSchema = z.object({
  monthlyReportId: z.string().uuid(),
  userId: z.string().uuid(),
  adjustmentType: z.enum(["deduction", "bonus", "correction"]),
  amountUsd: z.number().refine((v) => v !== 0, "El monto no puede ser 0"),
  description: z
    .string()
    .min(1, "La descripcion es requerida")
    .max(500),
});

// CSV Upload config
export const csvUploadConfigSchema = z.object({
  partnerId: z.string().uuid("Selecciona un Partner"),
  month: z.string().regex(/^\d{4}-\d{2}-01$/, "Selecciona un mes"),
  usdToMxn: z
    .number()
    .positive("Ingresa el tipo de cambio del deposito bancario"),
});

// User (collaborator)
export const userSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(255),
  email: z.string().email("Email invalido").optional().or(z.literal("")),
  userType: z.enum(["system_user", "virtual_profile"]),
});

// Login
export const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "Minimo 6 caracteres"),
});
