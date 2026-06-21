import type { Metadata } from "next";
import Link from "next/link";
import { HazelLogo } from "@/components/brand/HazelLogo";

export const metadata: Metadata = {
  title: "Privacy Policy — Hazel",
  description: "How Hazel handles contact and lead data on behalf of Plumb Renovations.",
};

// Public page (no auth, no app shell) — Meta and Google require a publicly
// reachable privacy policy URL for lead-ads and advertising integrations.
// Styled with the app's normal tokens (warm "interiors" theme).

const CONTACT_EMAIL = "privacy@plumbrenovations.com.au";
const LAST_UPDATED = "20 June 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-800 pt-6">
      <h2 className="font-display text-lg font-semibold tracking-tight text-slate-100">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-center">
            <HazelLogo size={30} />
          </Link>
          <Link href="/login" className="text-sm text-cyan-300 transition hover:text-cyan-400">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 sm:p-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-400/80 font-display">Privacy</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-slate-100">Privacy Policy</h1>
          <p className="mt-2 text-sm text-slate-500">Last updated {LAST_UPDATED}</p>

          <div className="mt-8 space-y-6">
            <div className="space-y-3 text-sm leading-relaxed text-slate-300">
              <p>
                Hazel is a private marketing tool used by{" "}
                <span className="font-medium text-slate-100">Plumb Renovations</span> (waterplumb.com.au) to manage
                marketing, advertising and customer enquiries for its bathroom, ensuite and laundry renovation services
                on the Gold Coast, Australia. This policy explains what personal information we collect through Hazel,
                how it is stored and used, who we share it with, and how you can ask us to access or delete it.
              </p>
              <p>
                In this policy, &ldquo;we&rdquo;, &ldquo;us&rdquo; and &ldquo;our&rdquo; refer to Plumb Renovations as
                the operator of Hazel.
              </p>
            </div>

            <Section title="Information we collect">
              <p>
                We collect the contact and enquiry details you provide when you ask us about a renovation. This
                typically includes:
              </p>
              <ul className="ml-4 list-disc space-y-1.5 text-slate-300 marker:text-slate-500">
                <li>your name;</li>
                <li>your email address and/or phone number;</li>
                <li>your suburb or location;</li>
                <li>details about the project you are enquiring about (for example the type of renovation, your message, and any preferences you share).</li>
              </ul>
              <p>We collect this information when you:</p>
              <ul className="ml-4 list-disc space-y-1.5 text-slate-300 marker:text-slate-500">
                <li>submit a <span className="text-slate-100">lead form on Facebook or Instagram</span> (Meta lead ads);</li>
                <li>submit a lead form through a <span className="text-slate-100">Google</span> ad or landing page;</li>
                <li>complete an enquiry or contact form on <span className="text-slate-100">our website</span>; or</li>
                <li>otherwise contact us about our services.</li>
              </ul>
              <p>
                We only collect information that is reasonably necessary to respond to your enquiry and provide our
                renovation services. We do not knowingly collect information from children.
              </p>
            </Section>

            <Section title="How we use your information">
              <p>We use the information we collect to:</p>
              <ul className="ml-4 list-disc space-y-1.5 text-slate-300 marker:text-slate-500">
                <li>respond to your enquiry and answer your questions;</li>
                <li>prepare and provide quotes and arrange site visits;</li>
                <li>contact you about your project by email, phone or message;</li>
                <li>keep a record of our communication with you; and</li>
                <li>understand and measure the performance of our advertising so we can improve it.</li>
              </ul>
            </Section>

            <Section title="Where your information is stored">
              <p>
                Contact and lead information collected through Hazel is stored in our database hosted on{" "}
                <span className="font-medium text-slate-100">Supabase</span>, a third-party cloud platform that provides
                our database, authentication and file storage. Data is transmitted over encrypted connections, and
                access is restricted to authorised Plumb Renovations staff who are signed in to Hazel.
              </p>
              <p>
                We keep your information only for as long as needed to respond to your enquiry, deliver our services and
                meet our legal and record-keeping obligations, after which it is deleted or de-identified.
              </p>
            </Section>

            <Section title="Advertising integrations (Meta and Google)">
              <p>
                Hazel connects to advertising platforms to run and measure our campaigns. The data shared with, or
                received from, these platforms is used for advertising and measurement only:
              </p>
              <ul className="ml-4 list-disc space-y-1.5 text-slate-300 marker:text-slate-500">
                <li>
                  <span className="font-medium text-slate-100">Meta</span> (Facebook and Instagram) — we receive the
                  leads you submit through Meta lead forms, and we use Meta&rsquo;s advertising tools to create and
                  manage ads. Meta&rsquo;s handling of your data is governed by the{" "}
                  <a
                    href="https://www.facebook.com/privacy/policy/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-300 underline underline-offset-2 transition hover:text-cyan-400"
                  >
                    Meta Privacy Policy
                  </a>
                  .
                </li>
                <li>
                  <span className="font-medium text-slate-100">Google</span> — we use Google Ads to run search and
                  display advertising and to measure conversions (for example, that an ad led to an enquiry).
                  Google&rsquo;s handling of your data is governed by the{" "}
                  <a
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-300 underline underline-offset-2 transition hover:text-cyan-400"
                  >
                    Google Privacy Policy
                  </a>
                  .
                </li>
              </ul>
              <p>
                We do not sell your personal information, and we do not share it with third parties except as needed to
                run our advertising and provide our services, or where required by law.
              </p>
            </Section>

            <Section title="Accessing or deleting your information">
              <p>
                You can ask us to access, correct or delete the personal information we hold about you at any time. To
                make a request, email us at{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=Privacy%20request`}
                  className="text-cyan-300 underline underline-offset-2 transition hover:text-cyan-400"
                >
                  {CONTACT_EMAIL}
                </a>{" "}
                and tell us what you would like us to do. We will verify your request and action it within a reasonable
                time. When you ask us to delete your information, we will remove it from Hazel and our Supabase database,
                except where we are required to keep certain records by law.
              </p>
            </Section>

            <Section title="Contact us">
              <p>
                If you have any questions about this policy or how we handle your information, please contact us at{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-cyan-300 underline underline-offset-2 transition hover:text-cyan-400"
                >
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </Section>

            <Section title="Changes to this policy">
              <p>
                We may update this policy from time to time. When we do, we will revise the &ldquo;last updated&rdquo;
                date at the top of this page.
              </p>
            </Section>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Hazel · operated by Plumb Renovations · waterplumb.com.au
        </p>
      </main>
    </div>
  );
}
