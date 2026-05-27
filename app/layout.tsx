import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "ACSL Stats",
  description: "Austrian College Sports League – Live Stats & Standings",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      {/* Apply saved theme before first paint to prevent flash */}
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem('acsl-theme')==='light')document.documentElement.classList.add('light')}catch(e){}`
        }} />
      </head>
      <body className="min-h-full flex flex-col bg-[#0a0a0a] text-white">
        <NavBar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
