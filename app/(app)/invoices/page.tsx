import Link from "next/link";
import { Receipt, ArrowRight } from "lucide-react";
import { Panel, SectionHeader } from "@/components/ui/primitives";

// Invoices live under the Quotes group. Progress-claim invoicing (branded
// invoice + PDF + mark paid / Xero) is a later PR; this keeps the nav item
// working with a clear "what's coming" state.
export default function Page() {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Receipt}
        title="Invoices"
        desc="Progress-claim invoicing — raise a branded invoice against an accepted quote's payment stages."
      />
      <Panel className="p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-cyan-400">
          <Receipt className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-display text-base font-semibold text-slate-100">Coming soon</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          Invoice the payment stages on a won job, send a branded PDF, and mark them paid (with Xero
          to follow). For now, set up your quotes and payment schedules.
        </p>
        <Link
          href="/quotes"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
        >
          Go to Quotes <ArrowRight className="h-4 w-4" />
        </Link>
      </Panel>
    </div>
  );
}
