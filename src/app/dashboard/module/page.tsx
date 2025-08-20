import { auth } from "@/server/auth";
import { api, HydrateClient } from "@/trpc/server";
import Login from "@/app/config/_components/_user/login-form";
import Navigation from "@/app/_components/navigation";
import ModuleGrid from "./_components/module-grid";

export default async function ModuleOverview() {
  const session = await auth();

  if(!session){
    return <Login />
  }  
  
  void api.module.getUserModules.prefetch()

  
return (
    <HydrateClient>
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-pirrot-blue-100 to-pirrot-blue-50">
       <Navigation />
       <div className="flex-1 p-4 flex flex-col gap-4">
        <div className="w-full ">
       <h1 className="text-4xl font-bold">Module</h1>
        </div>
        <ModuleGrid  />
       </div>
    </main>
    </HydrateClient>
  );
}
