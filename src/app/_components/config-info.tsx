'use client'
import { api } from "@/trpc/react"
import { Regions } from "@/util/book/regions"
export default function ConfigInfo(props:{ bid?: string }){
    const { bid } = props
    if(!bid) return null
    const [configData] = api.book.getById.useSuspenseQuery({id:bid})
    if(!configData) return null
    
    const { 
        name,
        region,
        bookTitle,
        subTitle,
        planEnd,
        planStart,
    } = configData

    return <div className="w-full max-w-md p-4">
        <ul className="flex flex-col gap-8">
        <li className="flex flex-col gap-1.5">
            <h3 className="font-bold text-2xl">Projekt Name:</h3>
            <h5 className="flex flex-col text-xl font-baloo">{name}</h5>
        </li>
        <li className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 flex flex-col gap-1.5">
            <h3 className="font-bold text-2xl">Buchtitel:</h3>
            <h5 className="flex flex-col text-xl font-baloo">{bookTitle}</h5>
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
            <h3 className="font-bold text-2xl">Untertitel:</h3>
            <h5 className="flex flex-col text-xl font-baloo">{subTitle}</h5>
        </div>
        </li>
       
        <li className="flex flex-col lg:flex-row  gap-8">
        <div className="flex-1 flex flex-col gap-1.5">
        <h5 className="font-bold text-2xl">Schuljahr:</h5>
            <div className="flex flex-col text-xl font-baloo">
            <span>Anfang: {planStart.toLocaleDateString()}</span>
            <span>Ende: {planEnd?.toLocaleDateString()}</span>
            </div>
            </div>

            <div className="flex-1 flex flex-col gap-1.5">
            <h3 className="font-bold text-2xl">Region:</h3>
            <h5 className="flex flex-col text-xl font-baloo">
                {Regions.find(r => r.code === region)?.land}
            </h5>
        </div>
        </li>
        </ul>
    </div>
}