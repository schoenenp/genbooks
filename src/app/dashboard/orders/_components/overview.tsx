'use client'

import LoadingSpinner from "@/app/_components/loading-spinner"
import { api } from "@/trpc/react"
import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { Calendar, Package, CreditCard, Truck, CheckCircle, Clock, XCircle, AlertCircle, RefreshCw } from "lucide-react"
import Link from "next/link";


type OrderOverviewProps = {
    orderId: string

}

export default function Overview({ orderId }: OrderOverviewProps) {
    const utils = api.useUtils()
    const orderData = api.order.getByPublicId.useQuery({
        orderId
    }, {
        enabled: orderId !== undefined
    })
    const cancelOrder = api.order.cancelPending.useMutation({
        onSuccess:async () => {
            await utils.order.getByPublicId.invalidate({orderId})
        }
    })
    
    if (orderData.isLoading || cancelOrder.isPending) {
        return (
            <div className="flex justify-center items-center p-8">
                <LoadingSpinner />
            </div>
        )
    }

    if (orderData.error) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-pirrot-red-400">
                <XCircle className="w-16 h-16 mb-4" />
                <h2 className="text-xl font-bold font-cairo mb-2">Fehler beim Laden</h2>
                <p className="text-pirrot-red-300">{orderData.error.message}</p>
            </div>
        )
    }

    if (!orderData.data) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-info-600">
                <AlertCircle className="w-16 h-16 mb-4" />
                <h2 className="text-xl font-bold font-cairo mb-2">Keine Bestellung gefunden</h2>
                <p className="text-info-500">Die angeforderte Bestellung konnte nicht gefunden werden.</p>
            </div>
        )
    }

    const order = orderData.data

    const getStatusConfig = (status: OrderStatus) => {
        switch (status) {
            case 'PENDING':
                return {
                    color: 'bg-warning-100 text-warning-800 border-warning-200',
                    icon: Clock,
                    text: 'Ausstehend'
                }
            case 'COMPLETED':
                return {
                    color: 'bg-success-100 text-success-800 border-success-200',
                    icon: CheckCircle,
                    text: 'Abgeschlossen'
                }
            case 'SHIPPED':
                return {
                    color: 'bg-pirrot-blue-100 text-pirrot-blue-800 border-pirrot-blue-200',
                    icon: Truck,
                    text: 'Versendet'
                }
            case 'CANCELED':
                return {
                    color: 'bg-pirrot-red-100 text-pirrot-red-800 border-pirrot-red-200',
                    icon: XCircle,
                    text: 'Storniert'
                }
            case 'FAILED':
                return {
                    color: 'bg-pirrot-red-100 text-pirrot-red-800 border-pirrot-red-200',
                    icon: XCircle,
                    text: 'Fehlgeschlagen'
                }
            default:
                return {
                    color: 'bg-info-100 text-info-800 border-info-200',
                    icon: AlertCircle,
                    text: 'Unbekannt'
                }
        }
    }

    const getPaymentStatusConfig = (status: PaymentStatus) => {
        switch (status) {
            case 'SUCCEEDED':
                return {
                    color: 'bg-success-100 text-success-800 border-success-200',
                    icon: CheckCircle,
                    text: 'Bezahlt'
                }
            case 'PENDING':
                return {
                    color: 'bg-warning-100 text-warning-800 border-warning-200',
                    icon: Clock,
                    text: 'Wartend'
                }
            case 'FAILED':
                return {
                    color: 'bg-pirrot-red-100 text-pirrot-red-800 border-pirrot-red-200',
                    icon: XCircle,
                    text: 'Fehlgeschlagen'
                }
            case 'CANCELLED':
                return {
                    color: 'bg-pirrot-red-100 text-pirrot-red-800 border-pirrot-red-200',
                    icon: XCircle,
                    text: 'Storniert'
                }
            case 'REFUNDED':
                return {
                    color: 'bg-info-100 text-info-800 border-info-200',
                    icon: RefreshCw,
                    text: 'Erstattet'
                }
            default:
                return {
                    color: 'bg-warning-100 text-warning-800 border-warning-200',
                    icon: Clock,
                    text: 'Unbekannt'
                }
        }
    }

    const statusConfig = getStatusConfig(order.status)
    const paymentConfig = getPaymentStatusConfig(order.paymentStatus as PaymentStatus)
    const StatusIcon = statusConfig.icon
    const PaymentIcon = paymentConfig.icon

    async function handleCancelOrder(){
        await cancelOrder.mutateAsync({ orderId })
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold font-cairo text-info-950 mb-2">
                    Bestellung #{order.id}
                </h1>
                <p className="text-info-600 font-baloo">
                    {order.name}
                </p>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Order Details Card */}
                <div className="lg:col-span-2">
                    <div className="bg-pirrot-blue-50/50 border border-pirrot-blue-200/30 rounded p-6 shadow-sm">
                        <h2 className="text-xl font-bold font-cairo text-info-950 mb-4 flex items-center gap-2">
                            <Package className="w-5 h-5" />
                            Bestelldetails
                        </h2>
                        
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-3 border-b border-pirrot-blue-200/30">
                                <span className="font-baloo text-info-700">Bestellnummer:</span>
                                <span className="font-bold font-cairo text-info-950">#{order.id}</span>
                            </div>
                            
                            <div className="flex justify-between items-center py-3 border-b border-pirrot-blue-200/30">
                                <span className="font-baloo text-info-700">Produkt:</span>
                                <span className="font-bold font-cairo text-info-950">{order.name}</span>
                            </div>
                            
                            <div className="flex justify-between items-center py-3 border-b border-pirrot-blue-200/30">
                                <span className="font-baloo text-info-700">Bestelldatum:</span>
                                <span className="font-cairo text-info-950 flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    {order.date}
                                </span>
                            </div>
                            
                            <div className="flex justify-between items-center py-3">
                                <span className="font-baloo text-info-700">Status:</span>
                                <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${statusConfig.color} flex items-center gap-2`}>
                                    <StatusIcon className="w-4 h-4" />
                                    {statusConfig.text}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payment & Pricing Card */}
                <div className="lg:col-span-1">
                    <div className="bg-pirrot-blue-50/50 border border-pirrot-blue-200/30 rounded p-6 shadow-sm">
                        <h2 className="text-xl font-bold font-cairo text-info-950 mb-4 flex items-center gap-2">
                            <CreditCard className="w-5 h-5" />
                            Zahlung & Preis
                        </h2>
                        
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-2">
                                <span className="font-baloo text-info-700">Produktpreis:</span>
                                <span className="font-bold font-cairo text-info-950">{order.price}</span>
                            </div>
                            
                            <div className="flex justify-between items-center py-2">
                                <span className="font-baloo text-info-700">Versand:</span>
                                <span className="font-bold font-cairo text-info-950">{order.shipping}</span>
                            </div>
                            
                            <div className="border-t border-pirrot-blue-200/30 pt-3">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold font-baloo text-info-950 text-lg">Gesamt:</span>
                                    <span className="font-bold font-cairo text-info-950 text-xl">{order.total}</span>
                                </div>
                            </div>
                            
                            <div className="pt-3">
                                <span className="font-baloo text-info-700 block mb-2">Zahlungsstatus:</span>
                                <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${paymentConfig.color} flex items-center gap-2 w-fit`}>
    <PaymentIcon className="w-4 h-4" />
    {paymentConfig.text}
</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <button type="button" disabled={!order.trackingId}  className="bg-pirrot-blue-300 hover:bg-pirrot-blue-400 text-white font-bold font-cairo py-3 px-6 rounded transition-colors duration-200 flex items-center justify-center gap-2">
                    <Truck className="w-5 h-5" />
                    Versand verfolgen
                </button>
                
                <Link target="_blank" rel="no referrer"  className="bg-info-100 hover:bg-info-200 text-info-800 font-bold font-cairo py-3 px-6 rounded transition-colors duration-200 flex items-center justify-center gap-2"
                href={order.invoiceUrl ?? "#"}>
                    <Package className="w-5 h-5" />
                    Rechnung herunterladen
                </Link>
                
                {order.status === 'PENDING' && (
                    <button type="button" onClick={handleCancelOrder} disabled={order.status !== 'PENDING'} className="bg-pirrot-red-300 hover:bg-pirrot-red-400 text-white font-bold font-cairo py-3 px-6 rounded transition-colors duration-200 flex items-center justify-center gap-2">
                        <XCircle className="w-5 h-5" />
                        Bestellung stornieren
                    </button>
                )}
            </div>
        </div>
    )
}