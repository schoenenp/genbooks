'use client'

import LoadingSpinner from "@/app/_components/loading-spinner"
import { api } from "@/trpc/react"
import Image from "next/image"

export default function ModulePreview(props:{moduleId: string}){
    const moduleData = api.module.getPreview.useQuery({
        mid: props.moduleId,
    })

    if(!moduleData.data && moduleData.isLoading){
        return <LoadingSpinner />
    } 
    
    const previewImage  = moduleData.data
    === "/default.png" 
    || moduleData.data?.startsWith("https://")
    ? moduleData.data 
    : `https://cdn.pirrot.de${moduleData.data}` 
    
        return <div className="relative size-full h-[420px]">
        <Image 
            className={"object-cover"} alt="preview"
            fill
            src={previewImage}
        />
        </div>
    
}