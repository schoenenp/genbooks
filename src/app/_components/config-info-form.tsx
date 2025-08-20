'use client'
import { useState } from "react"
import { Regions } from "@/util/book/regions"
import { SaveIcon, XIcon } from "lucide-react"
import { api } from "@/trpc/react"

type ConfigInfoFormState =  {
    id?: string;
    name: string | null;
    sub?: string | null;
    region: string | null;
    period: {
        start: string;
        end?: string;
    }
}

export default function ConfigInfoForm({
    initialFormState,
    onAbortForm
}: {
    initialFormState?: ConfigInfoFormState;
    onAbortForm: () => void
}){

    const [
        infoFormState,
        setInfoFormState
    ] = useState<ConfigInfoFormState>(
        initialFormState 
        ?? {} as ConfigInfoFormState
    )

    const [formError, setFormError] = useState<string|undefined>()
    const { id, name, sub, region, period } = infoFormState

    const utils = api.useUtils()
    const updateBookInfo = api.book.updateInfo.useMutation({
        onSuccess:async ()=>{
            await utils.book.invalidate()
            await utils.config.init.invalidate({
                bookId: id
            })
            onAbortForm()
        },
        onError: (err) => {
            switch (err.message) {
                case 'UNAUTHORIZED':
                    setFormError(`${err.message} —  Bitte loggen Sie sich ein um den Planer zu verwalten.`)
                    break;
            
                default:
                    console.log()
                    setFormError(`${err.message} — Formular Error, versuchen Sie es später erneut.`)
                    break;
            }
           
        }
    })

    function handleSaveConfigInfo(event:React.MouseEvent<HTMLButtonElement>){
        event.preventDefault()
        event.stopPropagation()
        updateBookInfo.mutate(infoFormState)
    }

    function handleSaveCancel(){
        onAbortForm()
    }


    if(formError) return <div className="flex flex-col gap-8 text-xl justify-center items-center font-baloo p-4 pt-5 pb-6">
        <div className="w-full flex justify-between">
           <h1 className="text-2xl font-bold text-pirrot-red-400">::Error::</h1> 
        </div>
        <p>{formError}</p>
        <button className="uppercase bg-pirrot-red-300 border border-pirrot-red-500/10 hover:bg-pirrot-red-400 transition duration-300 p-1 px-3 cursor-pointer rounded" type="button" onClick={() => setFormError(undefined)}>Ok</button>
    </div>

    return  <form className="flex flex-col gap-8 text-xl justify-center items-center font-baloo p-4 pt-5 pb-6">
            <div className="w-full flex flex-col gap-2 text-info-950">
                <label className="font-bold font-cairo" htmlFor="title">Titel</label>
                <input 
                    id="title"
                    className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2"
                    onChange={ (e) => setInfoFormState(prev => ({
                        ...prev,
                        name: e.target.value
                    })) }
                    value={name ?? ""} />
                    </div>
           <div className="flex flex-col gap-8 w-full md:flex-row">

            <div className="w-full flex-1 flex flex-col gap-2 text-info-950">
                <label className="font-bold font-cairo" htmlFor="name">Schulart / Untertitel</label>
                <input 
                    id="sub"
                    className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2"
                    list="schoolsList"
                    onChange={ (e) => setInfoFormState(prev => ({
                        ...prev,
                        sub: e.target.value
                    })) }
                    value={sub ?? ""} />
                     <datalist id="schoolsList">
        {["Grundschule", "Erweiterte Realschule", "Gesamtschule" ,"Gymnasium"].map((item, index) => (
          <option key={index} value={item} />
        ))}
      </datalist>
            </div>

            <div className="w-full flex-1">
            <label className="font-bold font-cairo" htmlFor="name">Bundesland</label>
                <select
                value={region ?? "DE-SL"}
                onChange={(e) => setInfoFormState(prev => ({
                    ...prev,
                    region: e.target.value
                }))}
                className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2"
                >
                    {Regions.sort((a,b) => a.land.localeCompare(b.land)).map((r,i) => <option key={i} value={r.code}>{r.land}</option>)}
                </select>
            </div>
            </div>
            <div className="w-full flex flex-col gap-8 lg:flex-row justify-between text-info-950">
                <div className="flex flex-1 flex-col gap-2">
                <label className="font-bold font-cairo"  htmlFor="start">Planer Start</label>
                <input 
    type="date" 
    value={period.start.split('T')[0]}
    onChange={(e) => setInfoFormState(prev => ({
        ...prev,
        period:{
            start:e.target.value,
            end: prev.period.end
        }
    }))}
    className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2" 
/>
                </div>
                
                <div className="flex flex-1 flex-col gap-2">
                <label className="font-bold font-cairo"  htmlFor="end">Planer Ende</label>
                <input  type="date" 
    value={period.end?.split('T')[0]}
    onChange={(e) => setInfoFormState(prev => ({
        ...prev,
        period:{
            start: prev.period.start,
            end:e.target.value,
        }
    }))}
    className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2" />
                </div>
            </div>
        <div className="w-full flex gap-8">
        <button type="button" onClick={handleSaveCancel} className={`hover:bg-pirrot-blue-100/50 relative flex-1 flex gap-2 cursor-pointer rounded border px-4 py-2 transition-colors duration-500 items-center justify-center hover:animate-pulse bg-pirrot-blue-50 text-info-950 border-white/50`}> Abbrechen <XIcon /></button>
        <button type="button" onClick={handleSaveConfigInfo}  className={`hover:bg-pirrot-blue-100/50 relative flex-1 flex items-center justify-center gap-2 cursor-pointer rounded border px-4 py-2 transition-colors duration-500 hover:animate-pulse bg-pirrot-blue-50 text-info-950 border-white/50`}>Speichern <SaveIcon /></button>
       
        </div>
        </form>
}