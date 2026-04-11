import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateReceiptPDF, type ReceiptPDFData } from "@/lib/pdf/receipt-pdf";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await params;
  const supabase = createServerSupabaseClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Fetch payment with all related data
  const { data: payment, error } = await supabase
    .from("payments")
    .select(`
      id, total_usd, total_mxn, exchange_rate, payment_method, notes, paid_at,
      partners (name, logo_url),
      users!payments_user_id_fkey (name, email),
      created_by_user:users!payments_created_by_fkey (name),
      payment_items (description, amount_usd, amount_mxn)
    `)
    .eq("id", paymentId)
    .single();

  if (error || !payment) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }

  const p = payment as any;

  const pdfData: ReceiptPDFData = {
    paymentId: p.id,
    partnerName: p.partners?.name ?? "Partner",
    partnerLogoUrl: p.partners?.logo_url ?? null,
    userName: p.users?.name ?? "—",
    userEmail: p.users?.email ?? null,
    totalUsd: Number(p.total_usd),
    totalMxn: Number(p.total_mxn),
    exchangeRate: Number(p.exchange_rate),
    paymentMethod: p.payment_method,
    notes: p.notes,
    paidAt: p.paid_at,
    createdByName: p.created_by_user?.name ?? null,
    items: (p.payment_items ?? []).map((i: any) => ({
      description: i.description,
      amountUsd: Number(i.amount_usd),
      amountMxn: Number(i.amount_mxn),
    })),
  };

  const pdfBuffer = await generateReceiptPDF(pdfData);

  const dateStr = new Date(p.paid_at).toISOString().split("T")[0];
  const filename = `recibo-${dateStr}-${paymentId.substring(0, 8)}.pdf`;

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
