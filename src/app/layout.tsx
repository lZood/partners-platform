import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@/components/shared/toast-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Partners Platform",
  description: "Gestión y distribución de ganancias de productos digitales",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
