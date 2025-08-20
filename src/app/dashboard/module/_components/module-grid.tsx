'use client'

import { PlusIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { api } from "@/trpc/react"
import { useState } from "react"
import Modal from "@/app/_components/modal"

export default function ModuleGrid(){

    const [items ] = api.module.getUserModules.useSuspenseQuery()
    const [deleteError, setDeleteError] = useState<string | undefined>()
    const [currentPage, setCurrentPage] = useState(1)
    const router = useRouter()

    const ITEMS_PER_PAGE = 11
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    const currentItems = items.slice(startIndex, endIndex)

    const util = api.useUtils()
    const deleteType = api.module.delete.useMutation({
        onSuccess:async () => {
            console.log("deleted type successfully")
            await util.module.invalidate()
        }
    })

    function handleDeleteType(e: React.MouseEvent<HTMLButtonElement>){
        e.preventDefault()
        e.stopPropagation()
        const deleteId = e.currentTarget.id
        deleteType.mutate({id:deleteId})
    }

    const handlePrevPage = () => {
        setCurrentPage(prev => Math.max(prev - 1, 1))
    }

    const handleNextPage = () => {
        setCurrentPage(prev => Math.min(prev + 1, totalPages))
    }

    return <div className="w-full">
        <Modal selector="modal-hook" show={deleteError !== undefined}>
            <div className="size-full flex z-[69] justify-center items-center bg-info-950/95 absolute top-0 left-0">
                <div className="w-full max-w-xl rounded-xl bg-pirrot-blue-50 p-2 text-info-950 flex flex-col gap-2 lg:p-4 border border-pirrot-blue-100/80">
                <h3>Error</h3>
                <p>{deleteError}</p>
                <button type="button" onClick={() => setDeleteError(undefined)}>Ok</button>
                </div>
            </div>
        </Modal>
        <div className="w-full"></div>
        <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <div onClick={() => router.push("/dashboard/module/manage")} className="cursor-pointer w-full aspect-video flex justify-center items-center p-1 rounded bg-pirrot-blue-50 text-pirrot-blue-500">
                <PlusIcon className="size-8" />
            </div>
            {currentItems.map(item => <div className="w-full rounded p-4 bg-pirrot-blue-100/50 border border-pirrot-blue-50 shadow-2xs cursor-pointer gap-4 aspect-video flex" key={item.id}>
                <div className="flex-1 flex flex-col gap-2">
  <h3 className="truncate text-xl font-bold uppercase max-w-40">{item.name}</h3>
                        <p className="uppercase text-sm font-light"><b className="font-bold">TYP:</b> {item.type}</p>
                    <div className="flex gap-2 mt-auto">
                        <button onClick={() => router.push(`/dashboard/module/manage?moduleId=${item.id}`)} className="uppercase bg-pirrot-red-300 border border-pirrot-red-500/10 hover:bg-pirrot-red-400 transition duration-300 p-1 px-3 rounded">bearbeiten</button>
                        <button id={item.id} type="button" onClick={handleDeleteType} className="uppercase bg-pirrot-red-300 border border-pirrot-red-500/10 hover:bg-pirrot-red-400 transition duration-300 p-1 px-3 rounded"><TrashIcon className="size-6" /></button>
                    </div>
                </div>
            </div>)}
        </div>
        
        {/* Pagination Controls */}
        <div className="mt-6 flex justify-center items-center gap-4">
            <button 
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="flex items-center gap-2 px-4 py-2 rounded bg-pirrot-blue-950 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-pirrot-blue-900 transition-colors"
            >
                <ChevronLeftIcon className="size-5" />
                Previous
            </button>
            <span className="text-pirrot-blue-950">
                Page {currentPage} of {totalPages}
            </span>
            <button 
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="flex items-center gap-2 px-4 py-2 rounded bg-pirrot-blue-950 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-pirrot-blue-900 transition-colors"
            >
                Next
                <ChevronRightIcon className="size-5" />
            </button>
        </div>
    </div>
}