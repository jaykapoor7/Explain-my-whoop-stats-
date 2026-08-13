import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, CONTACT_EMAIL, EFFECTIVE_DATE } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[13px] leading-relaxed text-ink-300">{children}</p>;
}
function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 font-display text-lg font-bold tracking-tight text-ink-50">{children}</h2>;
}
function LI({ children }: { children: React.ReactNode }) {
  return <li className="text-[13px] leading-relaxed text-ink-300">{children}</li>;
}

export default function PrivacyPage() {
  return (
    <div className="animate-fadeUp mx-auto max-w-2xl">
      <h1 className="font-display text-[2rem] font-bold tracking-[-0.02em] text-ink-50">Privacy Policy</h1>
      <p className="mt-1.5 text-[13px] text-ink-500">Last updated {EFFECTIVE_DATE}</p>

      <P>
        {APP_NAME} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) helps you understand your own health data. This policy explains
        what we collect, how we use it, and the choices you have. Using {APP_NAME} is entirely optional and under your
        control.
      </P>

      <H>Information we collect</H>
      <ul className="mt-3 list-disc space-y-1.5 pl-5">
        <LI><span className="text-ink-100">Google account details</span> — when you sign in with Google we receive your name, email address, profile picture and Google account ID, to create and identify your account.</LI>
        <LI><span className="text-ink-100">Health &amp; fitness data</span> — with your explicit consent, we read sleep, heart-rate variability, resting heart rate, workouts, steps, calories and weight from the Google Health API to compute your scores.</LI>
        <LI><span className="text-ink-100">Data you enter</span> — journal entries, medications, meals, planner tasks, goals and preferences you choose to log.</LI>
      </ul>

      <H>How we use your information</H>
      <P>
        We use your information solely to provide {APP_NAME} to you: to calculate your recovery, sleep, strain and
        energy scores, generate explanations and trends, power your journal, planner and nutrition tools, and sync your
        data across the devices you sign in on. We do <span className="text-ink-100">not</span> sell your data, use it
        for advertising, or share it with third parties for their own purposes.
      </P>
      <P>
        {APP_NAME}&rsquo;s use and transfer of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="text-recovery underline">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. Google user data is never used to train generalized AI or ML models.
      </P>

      <H>Storage &amp; security</H>
      <P>
        Your data is stored in our database and transmitted over encrypted HTTPS connections. Your Google refresh token
        is encrypted at rest (AES-256-GCM) and your session cookie is signed and HTTP-only. We use reputable
        infrastructure providers (application hosting and a managed database) that process data on our behalf.
      </P>

      <H>Retention &amp; deletion</H>
      <P>
        You are in control of your data at all times. You can clear this device&rsquo;s data (Settings → Reset local
        data), sign out, or <span className="text-ink-100">permanently delete your account</span> (Settings → Delete
        account), which erases your profile, your stored Google token and all of your cloud data. You may also email us
        to request deletion. We keep your data only as long as your account exists.
      </P>

      <H>Your rights</H>
      <P>
        You can access, export (via the app) or delete your data at any time. If you have questions or requests,
        contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-recovery underline">{CONTACT_EMAIL}</a>.
      </P>

      <H>Children</H>
      <P>{APP_NAME} is not intended for anyone under 16, and we do not knowingly collect their data.</P>

      <H>Not a medical service</H>
      <P>
        {APP_NAME} is a personal wellness tool, not a medical device, and does not provide medical advice, diagnosis or
        treatment. Always consult a qualified professional for medical concerns.
      </P>

      <H>Changes to this policy</H>
      <P>We may update this policy; material changes will be reflected by the &ldquo;last updated&rdquo; date above.</P>

      <H>Contact</H>
      <P>Questions? Email <a href={`mailto:${CONTACT_EMAIL}`} className="text-recovery underline">{CONTACT_EMAIL}</a>.</P>

      <div className="mt-10 border-t border-black/[0.06] pt-4 text-[12px] text-ink-500">
        <Link href="/terms" className="hover:text-ink-300">Terms of Service</Link> · <Link href="/today" className="hover:text-ink-300">Back to {APP_NAME}</Link>
      </div>
    </div>
  );
}
