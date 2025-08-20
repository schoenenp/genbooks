'use client'
import LoadingSpinner from "@/app/_components/loading-spinner"
import { api } from "@/trpc/react"
import { TrashIcon } from "lucide-react"
import Link from "next/link"

export default function PlanerSection () {
    const utils = api.useUtils()
    const [userBooks] = api.book.getUserBooks.useSuspenseQuery()
    const deleteBook = api.book.delete.useMutation({
        onSuccess:async () => {
            await utils.book.getUserBooks.invalidate()
        },
    })

    function handleDeleteBook(event: React.MouseEvent<HTMLButtonElement>){
        event.preventDefault()
        event.stopPropagation()
        const deletedBookId = event.currentTarget.id
        deleteBook.mutate({bookId: deletedBookId})
    }
    return <div className="flex-1 lg:min-h-96 border border-pirrot-blue-500/5 rounded p-4 flex flex-col gap-4 relative">
    <h2 className="text-2xl uppercase font-bold">Planer</h2>   
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {userBooks.map(book => <div className="rounded aspect-video p-2 flex flex-col bg-pirrot-blue-100/50 border border-pirrot-blue-50" key={book.id}>
        <Link href={`/config?bookId=${book.id}`} >
            {book.name}
        </Link>
        <div className="mt-auto flex gap-2">
        <Link className="uppercase bg-pirrot-red-300 border border-pirrot-red-500/10 hover:bg-pirrot-red-400 transition duration-300 p-1 px-3 rounded" href={`/config?bookId=${book.id}`} >
            Bearbeiten
        </Link>
        <button disabled={deleteBook.isPending} id={book.id} onClick={handleDeleteBook} className="uppercase bg-pirrot-red-300 border border-pirrot-red-500/10 hover:bg-pirrot-red-400 transition duration-300 p-1 px-3 cursor-pointer rounded">{deleteBook.isPending ? <LoadingSpinner /> : <TrashIcon />}</button>
            </div>
        </div>)}
    </div>
        </div>
}