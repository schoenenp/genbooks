import BookConfig from "../_components/book-config";
import { api, HydrateClient } from "@/trpc/server";

export default async function ConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ bookId: string }>
}) {

const { bookId } = await searchParams

  if(bookId){
    void api.config.init.prefetch({bookId})
  }

  return (
    <HydrateClient>
      <main className="min-h-screen w-full bg-gradient-to-b  from-pirrot-blue-50 to-pirrot-blue-100/20 text-info-900">
        <BookConfig 
          bookId={bookId} 
        />
      </main>
    </HydrateClient>
  );
}
