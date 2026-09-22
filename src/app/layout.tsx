import type { Metadata, Viewport } from "next";
import { Azeret_Mono, Bebas_Neue, Chakra_Petch } from "next/font/google";

import { Background } from "@/components/site/Background";
import { BootScreen } from "@/components/site/BootScreen";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { KeyboardNav } from "@/components/site/KeyboardNav";

import "./globals.css";

const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas" });
const chakra = Chakra_Petch({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-chakra",
});
const azeret = Azeret_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-azeret" });

export const metadata: Metadata = {
  title: { default: "Oliver Huang — Software Engineer", template: "%s · Oliver Huang" },
  description:
    "Oliver Huang — software engineer in Melbourne, originally from Auckland. Projects, travel and food.",
};

export const viewport: Viewport = { themeColor: "#08070c" };

/**
 * Runs before first paint: the boot screen plays once per session and never
 * under reduced motion. Doing this in CSS-land avoids a flash of the overlay.
 */
const bootScript = `try{var d=document.documentElement;if(sessionStorage.getItem("oh:booted")||matchMedia("(prefers-reduced-motion: reduce)").matches)d.dataset.boot="skip";sessionStorage.setItem("oh:booted","1")}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      // The boot script sets data-boot before hydration.
      suppressHydrationWarning
      className={`${bebas.variable} ${chakra.variable} ${azeret.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <BootScreen />
        <Background />
        <KeyboardNav />
        <div className="relative flex min-h-dvh flex-col overflow-x-clip">
          <Header />
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
