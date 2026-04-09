import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Lock, Unlock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatUSD, formatMXN, formatMonth } from "@/lib/utils";
import { ReportFilters } from "./report-filters";

interface PageProps {
  searchParams: Promise<{
    year?: string;
    partner?: string;
  }>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const supabase = createServerSupabaseClient();
  const params = await searchParams;

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user role
  const { data: appUser } = await supabase
    .from("users")
    .select(
      `
      id,
      user_partner_roles (role)
    `
    )
    .eq("auth_user_id", user.id)
    .single();

  const userRole = (appUser?.user_partner_roles as any)?.[0]?.role ?? "collaborator";
  const userId = appUser?.id;

  let allReports = null;

  // For collaborators, get only reports that contain their line items
  if (userRole === "collaborator" && userId) {
    // Get report IDs that contain this user's line items
    const { data: userReports } = await supabase
      .from("report_line_items")
      .select("monthly_report_id")
      .eq("user_id", userId);

    const reportIds = [...new Set((userReports ?? []).map((r: any) => r.monthly_report_id))];

    if (reportIds.length > 0) {
      const { data } = await supabase
        .from("monthly_reports")
        .select(
          `
          id,
          report_month,
          total_usd,
          total_mxn,
          is_locked,
          locked_at,
          created_at,
          partners (id, name),
          exchange_rates (usd_to_mxn)
        `
        )
        .in("id", reportIds)
        .order("report_month", { ascending: false });
      allReports = data;
    } else {
      allReports = [];
    }
  } else {
    // Admins and super_admins see all reports
    const { data } = await supabase
      .from("monthly_reports")
      .select(
        `
        id,
        report_month,
        total_usd,
        total_mxn,
        is_locked,
        locked_at,
        created_at,
        partners (id, name),
        exchange_rates (usd_to_mxn)
      `
      )
      .order("report_month", { ascending: false });
    allReports = data;
  }

  // Extract unique years from all reports
  const uniqueYears = Array.from(
    new Set(
      (allReports || []).map((report: any) => {
        const date = new Date(report.report_month);
        return date.getFullYear();
      })
    )
  ).sort((a, b) => b - a);

  // Extract unique partners
  const partnersMap = new Map();
  (allReports || []).forEach((report: any) => {
    if (report.partners?.id && report.partners?.name) {
      partnersMap.set(report.partners.id, report.partners.name);
    }
  });
  const uniquePartners = Array.from(partnersMap.entries())
    .map(([id, name]) => ({
      id,
      name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Filter reports based on searchParams
  let reports = allReports || [];

  if (params.year) {
    const selectedYear = parseInt(params.year);
    reports = reports.filter((report: any) => {
      const date = new Date(report.report_month);
      return date.getFullYear() === selectedYear;
    });
  }

  if (params.partner) {
    reports = reports.filter(
      (report: any) => report.partners?.id === params.partner
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Reportes Mensuales
        </h1>
        <p className="text-muted-foreground">
          Historial de reportes generados por mes.
        </p>
      </div>

      {!reports || reports.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
              <div className="text-center">
                <FileText className="mx-auto h-10 w-10 mb-3" />
                <p className="font-medium">No hay reportes aun</p>
                <p className="text-sm mt-1">
                  Los reportes apareceran aqui despues de subir y procesar un
                  CSV.
                </p>
                <Link href="/upload">
                  <Button className="mt-4" variant="outline">
                    Ir a Subir CSV
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div>
                <CardTitle>Reportes</CardTitle>
                <CardDescription>
                  Mostrando {reports.length} reporte{reports.length !== 1 ? "s" : ""}
                </CardDescription>
              </div>
              <ReportFilters
                years={uniqueYears}
                partners={uniquePartners}
                currentYear={params.year}
                currentPartner={params.partner}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">
                      Mes
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      Partner
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Total USD
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Total MXN
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      TC USD/MXN
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">
                      Estado
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report: any) => (
                    <tr
                      key={report.id}
                      className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 font-medium capitalize">
                        {formatMonth(report.report_month)}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {report.partners?.name ?? "—"}
                      </td>
                      <td className="py-3 text-right font-mono">
                        {formatUSD(Number(report.total_usd))}
                      </td>
                      <td className="py-3 text-right font-mono">
                        {formatMXN(Number(report.total_mxn))}
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        ${Number(report.exchange_rates?.usd_to_mxn ?? 0).toFixed(5)}
                      </td>
                      <td className="py-3">
                        {report.is_locked ? (
                          <Badge variant="default" className="gap-1">
                            <Lock className="h-3 w-3" />
                            Congelado
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="gap-1">
                            <Unlock className="h-3 w-3" />
                            Abierto
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <Link href={`/reports/${report.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="mr-1 h-4 w-4" />
                            Ver
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
