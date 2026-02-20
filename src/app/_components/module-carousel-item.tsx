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

    const getBorderColor = (moduleType: string) => {
        switch (moduleType) {
            case "umschlag":
                return " border-pirrot-blue-300  "
            case "wochenplaner":
                return " border-pirrot-green-300 "
            case "bindung":
                return " border-warning-300 "
            default:
                return " border-pirrot-red-300 "
        }
    }

    const [
        thumbnailUrl, 
        setThumbnailUrl
    ] = useState( thumbnail )
  
    const handleImageError = () => {
        setThumbnailUrl("/default.png");
    }

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
        <div className={`content-card flex min-w-0 flex-col gap-2
  ${props.isPicked
    ? "border-2 " + getBorderColor(type.toLocaleLowerCase())
    : "border-white/50"}
`}>
            <div className="flex p-1 justify-between">
            <h3 className="font-bold first-letter:uppercase">{type}</h3>
            <h3 className="text-sm truncate">{name}</h3>
        </div>
    <div className={`w-full aspect-video flex justify-end items-end-safe transition-colors duration-300 p-2 rounded-sm relative`}>
    {theme !== null && <span className='text-xs z-50 bg-pirrot-blue-50 p-1'>{theme}</span>}
<Image className="object-cover rounded" 
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
