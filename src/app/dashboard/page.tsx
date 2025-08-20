import Link from "next/link";

import { auth } from "@/server/auth";
import { api, HydrateClient } from "@/trpc/server";

import ProfileSection from "./_components/profile";
import { redirect } from "next/navigation";
import { BookCopy, Component, ReceiptEuro, UserIcon } from "lucide-react";
import ModulesSection from "./_components/modules";
import Navigation from "../_components/navigation";
import PlanerSection from "./_components/planers";
import OrdersSection from "./_components/orders";

export default async function Dashboard({
    searchParams,
  }: {
    searchParams: Promise<{ view: string }>
  }) {

  const session = await auth()
  const { view } = await searchParams

  void api.module.getUserModules.prefetch()
  void api.book.getUserBooks.prefetch()
  void api.order.initSection.prefetch()

  if(!session?.user) redirect("/")
  
    function renderView(){
      switch (view) {
          case "profil":
              return <ProfileSection {...session?.user} />
          case "planer":
              return <PlanerSection />
          case "module":
              return <ModulesSection />
          case "orders":
              return <OrdersSection />
          default:
              return <ProfileSection {...session?.user} />
      }
    }

  return (
    <HydrateClient>
     <main className="flex min-h-screen flex-col bg-gradient-to-b from-pirrot-blue-50 items-center to-pirrot-blue-100 text-info-900 relative">
     <div id="modal-hook"></div>
     <Navigation />
        <div className="w-full max-w-screen-xl flex flex-col flex-wrap lg:flex-row gap-4 p-4 py-16 relative">
        <h2 className="text-3xl w-full uppercase font-black">Dashboard</h2>
            <div className="w-full max-w-40 flex flex-col uppercase gap-2 text-xl">
        {DASHBOARD_LINKS.map((dl,idx) => <Link
              key={idx} 
              className={`
                flex gap-2 items-center
                ${view === dl.name 
                  || view === undefined 
                  ? "font-bold" 
                  : ""}
                `} 
                href={`?view=${dl.name}`}
              >
              {dl.icon}  {dl.name}
              </Link>)}
          </div>
           {renderView()}
        </div>
      </main>
    </HydrateClient>
  );
}

type DashLink = {
    name: string;
    link: string;
    icon: React.ReactNode;
}


const DASHBOARD_LINKS:DashLink[] = [
  {
    name:"profil",
    link:"profil",
    icon: <UserIcon />,
  },
  {
    name:"planer",
    link:"planer",
    icon: <BookCopy />,
  },
  {
    name:"module",
    link:"module",
    icon: <Component />,
  },
  {
    name:"orders",
    link:"orders",
    icon: <ReceiptEuro />,
  },
]