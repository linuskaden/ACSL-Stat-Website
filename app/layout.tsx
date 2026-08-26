import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { createClient } from "@/lib/supabase/server";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "ACSL Football",
  description: "Austrian College Sports League – Football: live scores, standings & player stats",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: navTeams } = await supabase
    .from("teams")
    .select("slug, name, short_name, logo_url, primary_color")
    .order("name");

  return (
    <html lang="en" className={`${archivo.variable} h-full`} suppressHydrationWarning>
      {/* Apply saved theme before first paint to prevent flash (light is default). */}
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem('acsl-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`
        }} />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--fg)] font-[family-name:var(--font-archivo)]">
        <NavBar teams={navTeams ?? []} />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
