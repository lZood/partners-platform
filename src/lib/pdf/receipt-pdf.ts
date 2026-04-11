import PDFDocument from "pdfkit";
import { formatUSD, formatMXN } from "@/lib/utils";

export interface ReceiptPDFData {
  paymentId: string;
  partnerName: string;
  partnerLogoUrl?: string | null;
  userName: string;
  userEmail: string | null;
  totalUsd: number;
  totalMxn: number;
  exchangeRate: number;
  paymentMethod: string | null;
  notes: string | null;
  paidAt: string;
  createdByName: string | null;
  items: {
    description: string;
    amountUsd: number;
    amountMxn: number;
  }[];
}

export async function generateReceiptPDF(data: ReceiptPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "letter",
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
    });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 100; // margins

    // Header
    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("Comprobante de Pago", { align: "center" });

    doc.moveDown(0.3);
    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor("#666666")
      .text(data.partnerName, { align: "center" });

    doc.moveDown(0.5);

    // Reference and date
    doc.fillColor("#000000");
    const paidDate = new Date(data.paidAt).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    doc.fontSize(9).fillColor("#999999");
    doc.text(`Referencia: ${data.paymentId.substring(0, 8).toUpperCase()}`, 50);
    doc.text(`Fecha de emision: ${paidDate}`, 50);

    doc.moveDown(1);

    // Divider
    doc
      .moveTo(50, doc.y)
      .lineTo(50 + pageWidth, doc.y)
      .strokeColor("#e5e7eb")
      .stroke();
    doc.moveDown(0.8);

    // Beneficiary info
    doc.fillColor("#000000").fontSize(10).font("Helvetica-Bold");
    doc.text("Beneficiario", 50);
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10).fillColor("#333333");
    doc.text(`Nombre: ${data.userName}`);
    if (data.userEmail) {
      doc.text(`Email: ${data.userEmail}`);
    }

    doc.moveDown(1);

    // Items table header
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#666666");
    const colX = 50;
    const colAmount = 50 + pageWidth - 80;

    doc.text("CONCEPTO", colX, doc.y);
    doc.text("MONTO USD", colAmount, doc.y - doc.currentLineHeight(), {
      width: 80,
      align: "right",
    });

    doc.moveDown(0.5);
    doc
      .moveTo(50, doc.y)
      .lineTo(50 + pageWidth, doc.y)
      .strokeColor("#e5e7eb")
      .stroke();
    doc.moveDown(0.4);

    // Items
    doc.font("Helvetica").fontSize(10).fillColor("#000000");
    for (const item of data.items) {
      const y = doc.y;
      doc.text(item.description, colX, y, {
        width: pageWidth - 100,
      });
      doc.text(formatUSD(item.amountUsd), colAmount, y, {
        width: 80,
        align: "right",
      });
      doc.moveDown(0.3);
    }

    // Divider before totals
    doc.moveDown(0.3);
    doc
      .moveTo(50, doc.y)
      .lineTo(50 + pageWidth, doc.y)
      .strokeColor("#e5e7eb")
      .stroke();
    doc.moveDown(0.5);

    // Totals
    doc.font("Helvetica").fontSize(10).fillColor("#666666");
    let y = doc.y;
    doc.text("Tipo de cambio:", colX, y);
    doc.text(`$${data.exchangeRate.toFixed(2)} MXN/USD`, colAmount - 80, y, {
      width: 160,
      align: "right",
    });

    doc.moveDown(0.4);
    y = doc.y;
    doc.text("Total MXN:", colX, y);
    doc.font("Helvetica-Bold").fillColor("#000000");
    doc.text(formatMXN(data.totalMxn), colAmount - 80, y, {
      width: 160,
      align: "right",
    });

    doc.moveDown(0.6);
    y = doc.y;
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#000000");
    doc.text("TOTAL USD:", colX, y);
    doc.text(formatUSD(data.totalUsd), colAmount - 80, y, {
      width: 160,
      align: "right",
    });

    doc.moveDown(1.5);

    // Payment info
    if (data.paymentMethod || data.notes) {
      doc
        .moveTo(50, doc.y)
        .lineTo(50 + pageWidth, doc.y)
        .strokeColor("#e5e7eb")
        .stroke();
      doc.moveDown(0.5);
      doc.fontSize(9).font("Helvetica").fillColor("#666666");
      if (data.paymentMethod) {
        doc.text(`Metodo de pago: ${data.paymentMethod}`, colX);
      }
      if (data.notes) {
        doc.text(`Notas: ${data.notes}`, colX);
      }
      if (data.createdByName) {
        doc.text(`Registrado por: ${data.createdByName}`, colX);
      }
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).fillColor("#999999");
    doc.text(
      "Este comprobante no tiene validez fiscal. Es un registro interno de pago.",
      colX,
      doc.y,
      { align: "center", width: pageWidth }
    );

    const timestamp = new Date().toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
    });
    doc.text(`Generado el ${timestamp}`, colX, doc.y, {
      align: "center",
      width: pageWidth,
    });

    doc.end();
  });
}
