import { generateCSVTemplate } from "@/lib/csv/parser";
import { NextResponse } from "next/server";

export async function GET() {
  const csv = generateCSVTemplate();

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="partners-template.csv"',
    },
  });
}
