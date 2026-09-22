import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { createClient } from "@/lib/supabase/server";
import { getSelectedCompetition } from "@/lib/competition";

// Montserrat mirrors the type used on acsl.at, tying the stats site to the
// main league site instead of a generic default face.
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-montserrat",
});

export async function generateMetadata(): Promise<Metadata> {
  const competition = await getSelectedCompetition();
  const sportLabel = competition.sport === "basketball" ? "Basketball" : "Football";
  return {
    title: competition.name,
    description: `Austrian College Sports League – ${sportLabel}: live scores, standings & player stats`,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const competition = await getSelectedCompetition();
  const { data: navTeams } = await supabase
    .from("teams")
    .select("slug, name, short_name, logo_url, primary_color")
    .order("name");

  return (
    <html lang="en" className={`${montserrat.variable} h-full`} suppressHydrationWarning>
      {/* Dark mode is an admin-only convenience; the public site is always light. */}
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `try{if(location.pathname.startsWith('/admin')&&localStorage.getItem('acsl-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`
        }} />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--fg)] font-[family-name:var(--font-montserrat)]">
        <NavBar teams={navTeams ?? []} competition={competition} />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
