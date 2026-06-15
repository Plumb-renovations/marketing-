import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DataProvider } from "@/components/DataProvider";
import AppShell from "@/components/AppShell";

// Protected shell. Middleware already gates auth; this is defense-in-depth and
// gives the layout a guaranteed user.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <DataProvider>
      <AppShell>{children}</AppShell>
    </DataProvider>
  );
}
