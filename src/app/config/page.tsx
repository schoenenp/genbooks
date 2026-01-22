import BookConfig from "../_components/book-config";
import { api, HydrateClient } from "@/trpc/server";
import { auth } from "@/server/auth";

export default async function ConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ bookId: string }>;
}) {
  const { bookId } = await searchParams;
  const session = await auth();
  const isLoggedIn = !!session?.user;

  if (bookId) {
    void api.config.init.prefetch({ bookId });
  }

  return (
    <HydrateClient>
      <main className="from-pirrot-blue-50 to-pirrot-blue-100/20 text-info-900 min-h-screen w-full bg-gradient-to-b">
        <BookConfig bookId={bookId} isLoggedIn={isLoggedIn} />
      </main>
    </HydrateClient>
  );
}
