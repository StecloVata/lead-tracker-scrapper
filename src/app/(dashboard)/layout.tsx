import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import DashboardShell from "@/components/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <DashboardShell userId={user.id}>
      <div className="min-h-screen flex flex-col">
        <Nav user={user} />
        <main className="flex-1 p-6 max-w-[1400px] mx-auto w-full">
          {children}
        </main>
      </div>
    </DashboardShell>
  );
}
