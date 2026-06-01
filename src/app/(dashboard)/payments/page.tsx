import { redirect } from "next/navigation";
import { getPaymentsSummary } from "@/actions/payments";
import { getActivePartnerContext } from "@/lib/active-partner";
import { PaymentsClient } from "./payments-client";

interface PageProps {
  searchParams: Promise<{ partner?: string }>;
}

export default async function PaymentsPage({ searchParams }: PageProps) {
  const ctx = await getActivePartnerContext();
  if (!ctx) redirect("/login");
  if (ctx.role === "collaborator") redirect("/");

  const params = await searchParams;

  // Honor `?partner=` as an explicit override, otherwise scope to the
  // currently active partner.
  const requestedPartner = params.partner;
  const partnerId =
    requestedPartner && ctx.accessiblePartnerIds.includes(requestedPartner)
      ? requestedPartner
      : ctx.activePartnerId ?? undefined;

  const result = await getPaymentsSummary(partnerId);

  return (
    <PaymentsClient
      summaries={result.success ? result.data : []}
      partners={ctx.accessiblePartners}
      currentPartnerId={partnerId}
    />
  );
}
