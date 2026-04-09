"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { partnerSchema } from "@/lib/validations/schemas";

export type PartnerActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

export async function getPartners(): Promise<PartnerActionResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("partners")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function getPartnerById(
  id: string
): Promise<PartnerActionResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("partners")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function createPartner(
  formData: FormData
): Promise<PartnerActionResult> {
  const supabase = createServerSupabaseClient();

  // Validate auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "No autenticado" };
  }

  // Parse and validate input
  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = partnerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(", "),
    };
  }

  const { data, error } = await supabase
    .from("partners")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: `Ya existe un partner con el nombre "${parsed.data.name}"` };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/settings/partners");
  return { success: true, data };
}

export async function updatePartner(
  id: string,
  formData: FormData
): Promise<PartnerActionResult> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "No autenticado" };
  }

  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = partnerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(", "),
    };
  }

  const { data, error } = await supabase
    .from("partners")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: `Ya existe un partner con el nombre "${parsed.data.name}"` };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/settings/partners");
  return { success: true, data };
}

export async function togglePartnerActive(
  id: string,
  isActive: boolean
): Promise<PartnerActionResult> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("partners")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings/partners");
  return { success: true };
}
