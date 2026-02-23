'use client'
import type {ModuleItemProps} from "./module-item"
import Image from "next/image"
import Modal from "./modal";
import { useState } from "react";
import { MinusIcon, PlusIcon, XIcon } from "lucide-react";
import ModulePreview from "./module-preview";

export default function ModuleCarouselItem(props: ModuleItemProps){
    const {id, thumbnail, name, theme, type } = props.item
    const [isPickingModule, setIsPickingModule] = useState(false)
    
    function handlePickedModule(event: React.FormEvent){
        event.preventDefault()
        event.stopPropagation()
        setIsPickingModule(false)
        props.onPickedItem({id, type})
    }

    const getIndicatorColor = (moduleType: string) => {
        switch (moduleType) {
            case "umschlag":
                return "var(--color-pirrot-blue-300)"
            case "wochenplaner":
                return "var(--color-pirrot-green-300)"
            case "bindung":
                return "var(--color-warning-300)"
            default:
                return "var(--color-pirrot-red-300)"
        }
    }

    const [
        thumbnailUrl, 
        setThumbnailUrl
    ] = useState( thumbnail )
  
    const handleImageError = () => {
        setThumbnailUrl("/default.png");
    }

    const pickedStyle = props.isPicked
        ? { outline: `2px solid ${getIndicatorColor(type.toLocaleLowerCase())}` }
        : undefined

    return <>
     <Modal selector="modal-hook" show={isPickingModule}>
        <div  className="absolute top-0 left-0 z-[69] flex size-full items-center justify-center bg-info-950/90">
<div className="content-card pointer-events-none z-[69] w-full max-w-xl p-4 text-pirrot-blue-950 font-bold">
<form onSubmit={handlePickedModule} className="w-full flex flex-col gap-1 pointer-events-auto">
    <div className="w-full flex justify-between items-center">
<h3 className="text-xl">{name}</h3>
<button onClick={()=> setIsPickingModule(false)} type="button"  className="btn-soft p-2 text-pirrot-blue-900">
    <XIcon />
</button>
    </div>
<div className="field-shell flex h-full w-full items-center justify-center rounded">
<ModulePreview moduleId={id} />
</div>
<div>
{props.isPicked ? <button className="btn-soft flex w-full items-center justify-between gap-2 p-2"><MinusIcon /> Abwählen </button> : <button  className="btn-solid flex w-full items-center justify-between gap-2 p-2"> <PlusIcon /> Auswählen</button>}
</div>
</form>
</div>
    </div>
    </Modal>
    <div onClick={() => setIsPickingModule(true)}  className={`select-none text-center relative flex flex-col gap-2 group cursor-pointer flex-[0_0_75%] sm:flex-[0_0_66%] xl:flex-[0_0_30%] min-w-0 pb-4 p-2 md:p-4 `}>
        <div
            style={pickedStyle}
            className="content-card flex min-w-0 flex-col gap-2"
        >
            <div className="flex p-1 justify-between">
            <h3 className="font-bold first-letter:uppercase">{type}</h3>
            <h3 className="text-sm truncate">{name}</h3>
        </div>
    <div className="relative flex aspect-video w-full items-end-safe justify-end rounded-[1rem] p-2 transition-colors duration-300">
    {theme !== null && <span className='text-xs z-50 bg-pirrot-blue-50 p-1'>{theme}</span>}
<Image className="rounded-[1rem] object-cover" 
    src={thumbnailUrl && thumbnailUrl !== null ? thumbnailUrl : "/default.png"}
    priority={false}
    onError={handleImageError} 
    alt={name}
    sizes="680"
    fill 
/>
   </div>
   </div>
 </div>
    </>
}
