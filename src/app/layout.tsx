import type { Metadata, Viewport } from "next";
import { Azeret_Mono, Bebas_Neue, Chakra_Petch } from "next/font/google";

import { Background } from "@/components/site/Background";
import { BootScreen } from "@/components/site/BootScreen";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { KeyboardNav } from "@/components/site/KeyboardNav";
import { SITE_URL } from "@/content/site";

import "./globals.css";

const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas" });
// Body text only ever uses 400; each extra weight is another font file on first load.
const chakra = Chakra_Petch({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-chakra",
});
const azeret = Azeret_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-azeret" });

/** Name plus role and city: what people actually type when searching for this Oliver Huang. */
const homeTitle = "Oliver Huang · Software Engineer, Melbourne";

const description =
  "Oliver Huang is a software engineer in Melbourne, originally from Auckland, joining Atlassian as a graduate. Projects, travel and food.";

export const metadata: Metadata = {
  // Resolves the generated opengraph-image to an absolute URL, which link previews require.
  metadataBase: new URL(SITE_URL),
  title: { default: homeTitle, template: "%s · Oliver Huang" },
  description,
  openGraph: {
    type: "website",
    siteName: "Oliver Huang",
    title: homeTitle,
    description,
    url: "/",
    locale: "en_AU",
  },
  twitter: { card: "summary_large_image", title: homeTitle, description },
};

export const viewport: Viewport = { themeColor: "#08070c" };

/**
 * Runs before first paint: the boot screen plays once per session and never
 * under reduced motion. Doing this in CSS-land avoids a flash of the overlay.
 *
 * `?boot` on any URL replays it, for reviewing or screenshotting the intro.
 * It overrides the once-per-session flag but not reduced motion — that one is
 * an accessibility preference, and a query string has no business winning.
 *
 * When it does play, the flag flips to "skip" once it has faded (3s), which
 * zeroes --boot-delay so later entrances don't wait on an overlay that's gone.
 */
const bootScript = `try{var d=document.documentElement;var f=new URLSearchParams(location.search).has("boot");if((!f&&sessionStorage.getItem("oh:booted"))||matchMedia("(prefers-reduced-motion: reduce)").matches)d.dataset.boot="skip";else setTimeout(function(){d.dataset.boot="skip"},3e3);sessionStorage.setItem("oh:booted","1")}catch(e){}`;

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
