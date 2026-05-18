import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-[#111223]">
      <Sidebar email={session.user.email ?? ""} />
      <main className="flex-1 ml-52 min-h-screen print:ml-0">
        {children}
      </main>
    </div>
  );
}
