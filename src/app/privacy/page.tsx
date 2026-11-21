import type { Metadata } from "next";

import { stagger } from "@/lib/motion";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "Privacy policy for Oliver Huang's apps that use Google sign-in.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "22 November 2026";
const CONTACT = "oliverwhuang@gmail.com";

const sections: { heading: string; body: string[] }[] = [
  {
    heading: "WHAT THIS COVERS",
    body: [
      "This policy covers the small apps I run under olivrhuang.com (for example finance.olivrhuang.com and places.olivrhuang.com) that let you sign in with Google. They are personal projects, run by me, Oliver Huang, in Australia.",
    ],
  },
  {
    heading: "WHAT I COLLECT",
    body: [
      "From Google sign-in: your name, email address and profile picture. I don't request access to your Gmail, Drive, contacts or any other Google data.",
      "What you put into an app: for example saved places, or transactions you import or connect. If you link a bank account to the finance app, account and transaction data is fetched through Basiq, an Australian open banking provider, only after you give consent on Basiq's own screen. I never see or store your bank login details.",
    ],
  },
  {
    heading: "HOW IT'S USED",
    body: [
      "Only to run the app for you: signing you in and showing you your own data. I don't sell your data, use it for advertising, or share it with anyone except the services needed to run the apps (Google for sign-in, Basiq for bank data, Cloudflare for hosting and encrypted backups).",
    ],
  },
  {
    heading: "WHERE IT'S KEPT",
    body: [
      "On my own server in Australia, with daily encrypted backups. Access is limited to me, and each app only shows you data you own.",
    ],
  },
  {
    heading: "DELETING YOUR DATA",
    body: [
      `Email ${CONTACT} and I'll delete your account and everything stored with it, normally within 7 days. You can also remove the app's access at any time from your Google account's security settings, and withdraw bank consent through Basiq.`,
    ],
  },
  {
    heading: "CONTACT",
    body: [
      `Questions about this policy: ${CONTACT}. If it changes, the date below changes with it.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-[22px] px-gutter py-[clamp(24px,4vw,56px)]">
      <p className="font-mono text-[12px] tracking-[0.3em] text-ink">PRIVACY</p>
      <h1 className="font-display text-about-title font-normal text-title">
        POLICY
      </h1>
      {sections.map((section, i) => (
        <section
          key={section.heading}
          style={stagger(i * 0.04)}
          className="flex animate-enter flex-col gap-2.5"
        >
          <h2 className="font-mono text-[11px] tracking-[0.22em] text-ink-muted">
            {section.heading}
          </h2>
          {section.body.map((para) => (
            <p
              key={para.slice(0, 32)}
              className="text-[16px] leading-[1.6] text-pretty text-ink-dim"
            >
              {para}
            </p>
          ))}
        </section>
      ))}
      <p className="font-mono text-[11px] tracking-[0.14em] text-ink-muted">
        LAST UPDATED · {UPDATED.toUpperCase()}
      </p>
    </main>
  );
}
