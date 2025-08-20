import { HomeIcon, LogInIcon, LogOutIcon, UserIcon } from "lucide-react";

import Link from "next/link";
import { auth } from "@/server/auth";

export default async function Navigation(){
    const session = await auth()

    return <div id="navigation" className="w-full sticky top-0 flex justify-between items-center text-white drop-shadow z-[101]">
        <i className="absolute h-full w-full bg-pirrot-blue-100/50 blur-lg p-4
        "></i>
        <div className="w-full p-2 relative flex justify-between items-center">
        <Link  className="text-pirrot-blue-50 z-[60]" href="/"><HomeIcon /></Link>
        <div>
        <div className="flex gap-2">
    {session?.user && <Link href="/dashboard"><UserIcon /></Link>}
    {session?.user ? (
        <Link href="/api/auth/signout"><LogOutIcon /></Link>
    ) : (
        <Link href="/api/auth/signin"><LogInIcon /></Link>
    )}
</div>
        </div>
        </div>
    </div>
}