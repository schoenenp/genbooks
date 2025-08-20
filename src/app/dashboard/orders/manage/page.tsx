import { auth } from "@/server/auth";
import { api, HydrateClient } from "@/trpc/server";
import Login from "@/app/config/_components/_user/login-form";
import Navigation from "@/app/_components/navigation";
import Overview from "../_components/overview";
// import ModuleForm from "./_components/module-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function OrderManage(props: {
  searchParams: SearchParams,
  params: Promise<Record<string, string | string[] | undefined>>
}) {
    const session = await auth();

    const {searchParams} = props
    const payload = (await searchParams).pl as string | undefined

    if(!session){
      return <Login />
    }  

    void api.module.initPage.prefetch()

return (
    <HydrateClient>
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-pirrot-blue-100 to-pirrot-blue-50 text-pirrot-blue-50">
       <Navigation />
       <div className="p-4 flex h-full flex-col gap-4 overflow-y-auto">
        <Overview orderId={payload ?? ""} />
       </div>
    </main>
    </HydrateClient>
  );
}
