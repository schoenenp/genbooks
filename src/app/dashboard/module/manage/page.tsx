import { auth } from "@/server/auth";
import { api, HydrateClient } from "@/trpc/server";
import Login from "@/app/config/_components/_user/login-form";
import Navigation from "@/app/_components/navigation";
import ModuleForm from "./_components/module-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function ModuleManage(props: {
  searchParams: SearchParams,
  params: Promise<Record<string, string | string[] | undefined>>
}) {
    const session = await auth();

    const {searchParams} = props
    const paramsId = (await searchParams).moduleId as string | undefined

    if(!session){
      return <Login />
    }  

    void api.module.initPage.prefetch()

return (
    <HydrateClient>
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden text-info-900">
       <div className="subtle-grid pointer-events-none absolute inset-0 opacity-35" />
       <Navigation />
       <div className="section-shell z-10 flex h-full flex-col gap-4 overflow-y-auto py-10">
        <div className="w-full">
       <h1 className="text-4xl font-black uppercase">Module</h1>
        </div>
        <ModuleForm moduleId={paramsId} />
       </div>
    </main>
    </HydrateClient>
  );
}
