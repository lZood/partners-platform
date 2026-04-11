import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generatePaymentsExcel } from "@/lib/excel/payments-excel";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "2020-01-01";
  const to = searchParams.get("to") ?? new Date().toISOString().split("T")[0];
  const partnerId = searchParams.get("partnerId");

  let query = supabase
    .from("payments")
    .select(`
      id, total_usd, total_mxn, exchange_rate, payment_method, paid_at,
      users!payments_user_id_fkey (name),
      partners (name),
      payment_items (description, amount_usd, amount_mxn)
    `)
    .gte("paid_at", from)
    .lte("paid_at", to + "T23:59:59")
    .order("paid_at", { ascending: false });

  if (partnerId) query = query.eq("partner_id", partnerId);

  const { data: payments } = await query;

  let partnerName: string | null = null;
  if (partnerId) {
    const { data: p } = await supabase
      .from("partners")
      .select("name")
      .eq("id", partnerId)
      .single();
    partnerName = (p as any)?.name ?? null;
  }

  const buffer = await generatePaymentsExcel({
    fromDate: from,
    toDate: to,
    partnerName,
    payments: (payments ?? []).map((p: any) => ({
      paidAt: p.paid_at,
      userName: p.users?.name ?? "—",
      totalUsd: Number(p.total_usd),
      totalMxn: Number(p.total_mxn),
      exchangeRate: Number(p.exchange_rate),
      paymentMethod: p.payment_method,
      items: (p.payment_items ?? []).map((i: any) => ({
        description: i.description,
        amountUsd: Number(i.amount_usd),
        amountMxn: Number(i.amount_mxn),
      })),
    })),
  });

  const filename = `pagos-${from}-a-${to}.xlsx`;
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
