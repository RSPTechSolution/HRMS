import type { Metadata } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import { cookies } from "next/headers";
import { IconSprite } from "@/components/ui/IconSprite";
import { Interactions } from "@/components/shell/Interactions";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", weight: ["500", "600", "700", "800"] });
const ui = Manrope({ subsets: ["latin"], variable: "--font-manrope", weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "LN People", template: "%s · LN People" },
  description: "LN Webworks' people and HR system",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("lnp_theme")?.value === "dark" ? "dark" : "light";
  return (
    <html lang="en" data-theme={theme} className={`${display.variable} ${ui.variable}`}>
      <body>
        <IconSprite />
        {children}
        <Interactions />
      </body>
    </html>
  );
}
