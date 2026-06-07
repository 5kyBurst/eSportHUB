import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VCT Predict",
  description: "Prédis les résultats des compétitions VCT et collecte des cartes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
