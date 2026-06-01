import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateReceiptPDF } from "@/lib/pdf/receipt-pdf";
import { getPaymentReceiptData } from "@/actions/payments";

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

  const receiptData = await getPaymentReceiptData(paymentId);
  if (!receiptData) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }

  const pdfBuffer = await generateReceiptPDF(receiptData);

  const dateStr = new Date(receiptData.paidAt).toISOString().split("T")[0];
  const filename = `pago-${dateStr}-${paymentId.substring(0, 8)}.pdf`;

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
