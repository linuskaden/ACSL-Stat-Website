import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "ACSL Stats",
  description: "Austrian College Sports League – Live Stats & Standings",
  icons: {
    icon: "/logos/ACSL-Logo.png",
    apple: "/logos/ACSL-Logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} h-full`} suppressHydrationWarning>
      {/* Apply saved theme before first paint to prevent flash (light is default). */}
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem('acsl-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`
        }} />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--fg)] font-[family-name:var(--font-archivo)]">
        <NavBar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
