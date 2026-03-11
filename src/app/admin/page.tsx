import { redirect } from "next/navigation";
import Navigation from "@/app/_components/navigation";
import { HydrateClient } from "@/trpc/server";
import { auth } from "@/server/auth";
import AdminWorkspace from "./_components/admin-workspace";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF") {
    redirect("/dashboard?view=partner");
  }

  return (
    <HydrateClient>
      <main className="relative flex min-h-screen flex-col items-center overflow-hidden text-info-900">
        <div className="subtle-grid pointer-events-none absolute inset-0 opacity-35" />
        <Navigation />
        <div className="section-shell relative flex w-full flex-col gap-6 py-16">
          <h2 className="text-3xl font-black uppercase lg:text-4xl">Admin Workspace</h2>
          <AdminWorkspace />
        </div>
      </main>
    </HydrateClient>
  );
}
