import QuoteBuilder from "@/components/quotes/QuoteBuilder";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lead?: string }>;
}) {
  const { id } = await params;
  const { lead } = await searchParams;
  return <QuoteBuilder id={id} leadPrefill={lead} />;
}
