import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, CONTACT_EMAIL, EFFECTIVE_DATE } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Service" };

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[13px] leading-relaxed text-ink-300">{children}</p>;
}
function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 font-display text-lg font-bold tracking-tight text-ink-50">{children}</h2>;
}

export default function TermsPage() {
  return (
    <div className="animate-fadeUp mx-auto max-w-2xl">
      <h1 className="font-display text-[2rem] font-bold tracking-[-0.02em] text-ink-50">Terms of Service</h1>
      <p className="mt-1.5 text-[13px] text-ink-500">Last updated {EFFECTIVE_DATE}</p>

      <P>By using {APP_NAME}, you agree to these terms. If you don&rsquo;t agree, please don&rsquo;t use the service.</P>

      <H>What {APP_NAME} is</H>
      <P>
        {APP_NAME} is a personal wellness tool that turns data from your wearable into scores, explanations and
        insights, alongside journaling, medication, nutrition and planning features. It is provided for your personal,
        informational use.
      </P>

      <H>Not medical advice</H>
      <P>
        {APP_NAME} is <span className="text-ink-100">not a medical device</span> and does not provide medical advice,
        diagnosis or treatment. Scores and insights are estimates for general wellness and may be inaccurate. Never use
        {" "}{APP_NAME} as a substitute for professional medical judgement, and seek qualified care for any health
        concern.
      </P>

      <H>Your account</H>
      <P>
        You sign in with Google and are responsible for activity on your account and for keeping your Google account
        secure. You must provide accurate information and use {APP_NAME} only for lawful, personal purposes.
      </P>

      <H>Your data</H>
      <P>
        Your use of {APP_NAME} is also governed by our{" "}
        <Link href="/privacy" className="text-recovery underline">Privacy Policy</Link>. You retain ownership of the
        data you provide, and can delete it or your account at any time.
      </P>

      <H>Availability &amp; changes</H>
      <P>
        {APP_NAME} is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind. We
        may change, suspend or discontinue features at any time, and may update these terms; continued use means you
        accept the changes.
      </P>

      <H>Limitation of liability</H>
      <P>
        To the fullest extent permitted by law, {APP_NAME} and its operators are not liable for any indirect,
        incidental or consequential damages, or for decisions you make based on the app. Your use is at your own risk.
      </P>

      <H>Contact</H>
      <P>Questions about these terms? Email <a href={`mailto:${CONTACT_EMAIL}`} className="text-recovery underline">{CONTACT_EMAIL}</a>.</P>

      <div className="mt-10 border-t border-black/[0.06] pt-4 text-[12px] text-ink-500">
        <Link href="/privacy" className="hover:text-ink-300">Privacy Policy</Link> · <Link href="/today" className="hover:text-ink-300">Back to {APP_NAME}</Link>
      </div>
    </div>
  );
}
