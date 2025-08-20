'use client'
import { useState, useCallback } from 'react'
import { CircleQuestionMark, Coins, XIcon } from 'lucide-react'
import { api } from '@/trpc/react'
import { AddressForm } from './address-form'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import LoadingSpinner from './loading-spinner'


export type OrderAddress = {
  org: string
  title: string
  name: string
  prename: string
  street: string
  streetNr: string
  city: string
  zip: string
  email: string
  optional?: string
  phone?: string
}

export default function ConfigOrderForm({
  bookId,
  initialFormState,
  onAbortForm,
  quantity,
  format
}: {
  bookId: string
  initialFormState?: OrderAddress
  onAbortForm: () => void
  quantity: number
  format: string
}) {
  
  const [orderFormAddress, setOrderFormAddress] = useState<OrderAddress>(
    initialFormState ?? ({} as OrderAddress),
  )
  const router = useRouter()
  const [formError, setFormError] = useState<string | undefined>()
  const [isPickup, setIsPickup] = useState(false)
  const [saveUser, setSaveUser] = useState(false)
 

  const orderObject = {
    orderAddress:orderFormAddress,
    details:{
      bookId,
      quantity,
      isPickup,
      saveUser,
      format: format as "DIN A4" | "DIN A5"
    },
  }

  const updateBilling = useCallback(
    (patch: Partial<OrderAddress>) =>
      setOrderFormAddress((prev) => ({ ...prev, ...patch })),
    [],
  )
  
  const isOrderFormStateValid =
    !!orderFormAddress.prename &&
    !!orderFormAddress.name &&
    !!orderFormAddress.street &&
    !!orderFormAddress.streetNr &&
    !!orderFormAddress.city &&
    !!orderFormAddress.zip &&
    !!orderFormAddress.email &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orderFormAddress.email)

 
  const utils = api.useUtils()
  const setupBookOrder = api.config.setupOrder.useMutation({
    onSuccess: async (data) => {
      await utils.book.invalidate()
      await utils.config.invalidate()
      if(data.checkout_session){
        router.push(data.checkout_session)
      } else {
        setFormError("Fehler beim Erstellen der Zahlung")
      }
    },
    onError: (err) => {
      setFormError(
        err.message === 'UNAUTHORIZED'
          ? `${err.message} —  Bitte loggen Sie sich ein um den Planer zu verwalten.`
          : `${err.message} — Formular Error, versuchen Sie es später erneut.`,
      )
    },
  })

  const handleSaveConfigOrder = () => {
    console.log(orderFormAddress)
    setupBookOrder.mutate(orderObject)
  }

  const handleOrderCancel = () => onAbortForm()

  if(setupBookOrder.isPending){
    return <div className="flex justify-center items-center p-4 pt-5 pb-6">
    <LoadingSpinner />
  </div>
  }

  if (formError)
    return (
      <div className="flex flex-col gap-2 md:gap-4 lg:gap-8 justify-center items-center font-baloo p-4 pt-5 pb-6">
        <div className="w-full flex justify-between">
          <h1 className="text-2xl font-bold text-pirrot-red-400">::Error::</h1>
        </div>          
        <p>{formError}</p>
        <button
          className="uppercase bg-pirrot-red-300 border border-pirrot-red-500/10 hover:bg-pirrot-red-400 transition duration-300 p-1 px-3 cursor-pointer rounded"
          type="button"
          onClick={() => setFormError(undefined)}
        >
          Ok
        </button>
      </div>
    )

  return (
    <div className="flex gap-2 flex-col lg:flex-row flex-wrap font-baloo">
      {/* left column */}
      <div className="w-full lg:max-w-xs flex flex-col gap-2 p-4">
        <div className="w-full aspect-video p-1">
          <h3 className="font-bold font-cairo">Ihre Adressen:</h3>
          <p className="mb-2">
            Die Rechnungsadresse wird standardmäßig als Lieferadresse genutzt.
            Falls abweichend, geben Sie bitte eine separate Lieferadresse an.
          </p>
         
        </div>

        <div
          className={`w-full aspect-video p-2 border rounded border-pirrot-blue-500 bg-pirrot-blue-100/50`}
        >
          <h3 className="font-bold font-cairo">Rechnungsadresse</h3>
          <p className="text-sm">
            <b>{orderFormAddress.org}</b>
            <br />
            {orderFormAddress.title ?? ""} {orderFormAddress.prename} {orderFormAddress.name}
            <br />
            {orderFormAddress.street} {orderFormAddress.streetNr}
            <br />
            {orderFormAddress.zip} {orderFormAddress.city}
            <br />
            {orderFormAddress.optional}
          </p>
        </div>
      </div>

      {/* right column – forms */}

            <AddressForm
              state={orderFormAddress}
              setter={(patch) => updateBilling(patch)}
              title="Rechnungsadresse"
            />
            
   
      <div className="w-full flex items-center gap-1 text-info-950 relative">
            <input
              id="isPickup"
              type="checkbox"
              checked={isPickup}
              onChange={(e) => {
                setIsPickup(e.target.checked)
              }}
              className="mr-2"
            />
            <label htmlFor="isPickup" className="font-cairo items-center flex gap-2 relative">
              Abholung Vorort<Link className='group flex gap-2 items-center' target='_blank' rel='no referrer' href="https://www.google.com/maps/search/?api=1&query=Digitaldruck%20Pirrot%20GmbH,Trierer%20Str"><CircleQuestionMark className='size-5' /> <span className='hidden group-hover:flex text-pirrot-red-400'>Link zur Hauptfiliale</span></Link>
            </label>
          </div>
      <div className="w-full flex items-center gap-1 text-info-950">
        <input
          id="saveUser"
          type="checkbox"
          checked={saveUser ?? false}
          onChange={(e) => setSaveUser(e.target.checked)}
          className="mr-2"
        />
        <label htmlFor="saveUser" className="font-cairo">
          Daten für nächsten Besuch speichern
        </label>
      </div>
      
      <div className="w-full basis-full flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleOrderCancel}
          className="hover:bg-pirrot-blue-100/50 relative items-center justify-center cursor-pointer px-4 py-2 transition-colors duration-500 hover:animate-pulse text-info-950 border-pirrot-blue-300/10 bg-pirrot-blue-100/20 flex gap-1 rounded border p-2 font-bold"
        >
          Abbrechen <XIcon />
        </button>
        <button
          type="button"
          disabled={!isOrderFormStateValid}
          onClick={handleSaveConfigOrder}
          className="hover:bg-pirrot-blue-100/50 relative items-center justify-center cursor-pointer px-4 py-2 transition-colors duration-500 hover:animate-pulse text-info-950 border-pirrot-blue-300/10 bg-pirrot-blue-100/20 flex gap-1 rounded border p-2 font-bold disabled:opacity-25"
        >
          Zahlungspflichtig Bestellen <Coins />
        </button>
      </div>
    </div>
  )
}
