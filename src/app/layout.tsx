import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { CookieConsent } from "@/components/ui/CookieConsent";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Offsettable | Fund Verified Impact. Stay Audit-Ready.",
  description:
    "Offsettable is a verified ESG impact platform connecting corporates, funders, and institutions to audit-ready social and environmental projects.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col font-sans bg-background text-foreground"
        suppressHydrationWarning
      >
        <AuthProvider>
          <main className="flex-grow flex flex-col">{children}</main>
          <CookieConsent />
        </AuthProvider>
      </body>
    </html>
  );
}
