import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUserPaymentDetail } from "@/actions/payments";
import { PaymentDetailClient } from "./payment-detail-client";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function PaymentDetailPage({ params }: PageProps) {
  const { userId } = await params;
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get partners for the forms
  const { data: partners } = await supabase
    .from("partners")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  // Get latest exchange rate
  const { data: latestRate } = await supabase
    .from("exchange_rates")
    .select("usd_to_mxn")
    .order("month", { ascending: false })
    .limit(1);

  const result = await getUserPaymentDetail(userId);

  if (!result.success) {
    redirect("/payments");
  }

  return (
    <PaymentDetailClient
      data={result.data}
      partners={partners ?? []}
      defaultExchangeRate={Number((latestRate as any)?.[0]?.usd_to_mxn ?? 17)}
    />
  );
}
