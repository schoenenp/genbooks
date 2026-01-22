import { HomeIcon, LogInIcon, LogOutIcon, UserIcon } from "lucide-react";

import Link from "next/link";
import { auth } from "@/server/auth";

export default async function Navigation() {
  const session = await auth();

  return (
    <div
      id="navigation"
      className="sticky top-0 z-[101] flex w-full items-center justify-between text-white drop-shadow"
    >
      <i className="bg-pirrot-blue-100/50 absolute h-full w-full p-4 blur-lg"></i>
      <div className="relative flex w-full items-center justify-between p-2">
        <Link className="text-pirrot-blue-50 z-[60]" href="/">
          <HomeIcon />
        </Link>
        <div>
          <div className="flex gap-2">
            {session?.user && (
              <Link href="/dashboard">
                <UserIcon />
              </Link>
            )}
            {session?.user ? (
              <Link href="/auth/signout">
                <LogOutIcon />
              </Link>
            ) : (
              <Link href="/auth/signin">
                <LogInIcon />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
