'use client'
import { api } from "@/trpc/react"
import OrderList from "../orders/_components/order-list"
import Link from "next/link"

export default function OrdersSection () {
    const [ordersData] = api.order.initSection.useSuspenseQuery()
    const {all, latest} = ordersData

  
    return <div className="flex-1 lg:min-h-96 border border-pirrot-blue-500/5 rounded p-4 flex flex-col gap-4 relative">
    <h2 className="text-2xl uppercase font-bold">Bestellübersicht</h2>
    <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
        Hier können Sie den aktuellen Status Ihrer letzten Bestellungen einsehen und bestehende Adressen bearbeiten.
        </div>
        <div className="flex-1 overflow-hidden aspect-video rounded border border-info-50 bg-info-100/50 p-1">
        <div className="size-full flex justify-between flex-col">
        <h3 className="text-xl font-bold">Letzte Bestellung:</h3>
        {latest ? <ul>
            <li>{latest?.name}</li>
            <li>{latest?.status}</li>
            <li>{latest?.date}</li>
        </ul> : <div className="p-2 py-6 flex justify-center items-center">
            Keine Bestellung gefunden.
            </div>}
        <div>
            <Link href={`/dashboard/orders/manage?pl=${latest?.hash}`} className="font-semibold">
                Ansehen
            </Link>
        </div>
        </div>
        </div>
        <div className="flex-1 aspect-video rounded border border-info-50 bg-info-100/50">Adressen</div>
    </div>
    <OrderList orders={all} />
        </div>
}