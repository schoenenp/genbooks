'use client'
import Image from "next/image"
import Modal from "./modal";
import { useState } from "react";
import { MinusIcon, PlusIcon, XIcon } from "lucide-react";
import ModulePreview from "./module-preview";

export type ModulePickerItem = {
    id:         string;
    name:       string;
    theme:      string | null;
    thumbnail?: string | null;
    type:       string;
    part:       string;
}

export type ModuleItemProps = {
    item: ModulePickerItem;
    onPickedItem: (pickedItem: {id: string; type: string}) => void;
    isPicked: boolean;
}

export default function ModuleItem(props: ModuleItemProps){
    const {id, thumbnail, name, theme, type } = props.item
    const [isPickingModule, setIsPickingModule] = useState(false)
    const [
        thumbnailUrl, 
        setThumbnailUrl
    ] = useState( thumbnail )
  
    const handleImageError = () => {
        setThumbnailUrl("/default.png");
    }
    
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
            case "custom":
                return " border-purple-300 "
            default:
                if(theme !== null && theme === "custom" ){
                    return " border-purple-300 "
                }
                return " border-pirrot-red-300 "
        }
    }

    return <>
     <Modal selector="modal-hook" show={isPickingModule}>
        <div  className="absolute top-0 left-0 size-full flex z-[69] bg-info-950/90 justify-center items-center">
<div className="w-full text-pirrot-blue-950 font-bold p-4 max-w-xl rounded-xl bg-pirrot-blue-50 z-[69] pointer-events-none">
<form onSubmit={handlePickedModule} className="w-full flex flex-col gap-1 pointer-events-auto">
    <div className="w-full flex justify-between items-center">
<h3 className="text-xl">{name}</h3>
<button onClick={()=> setIsPickingModule(false)} type="button"  className="p-2  bg-pirrot-red-400 rounded text-pirrot-blue-50">
    <XIcon />
</button>
    </div>
<div className="w-full flex justify-center items-center h-full border-2 rounded">
<ModulePreview moduleId={id} />
</div>
<div>
{props.isPicked ? <button className="w-full p-2  items-center justify-between bg-pirrot-red-100 text-center  rounded text-info-950 flex gap-2"><MinusIcon /> Abwählen </button> : <button  className="w-full p-2  items-center justify-between border-2 border-pirrot-blue-950  text-center  rounded text-info-950 flex gap-2"> <PlusIcon /> Auswählen</button>}
</div>
</form>
</div>
    </div>
    </Modal>
    <div onClick={() => setIsPickingModule(true)}  className={`select-none relative flex flex-col shadow-sm justify-between border border-pirrot-blue-50 rounded gap-2 group cursor-pointer ${props.isPicked && "border-2 rounded " + getBorderColor(type.toLocaleLowerCase())}  min-w-0 bg-pirrot-blue-50/80`}>
        <div className="flex flex-col lg:flex-row justify-between gap-1 lg:gap-4 p-1 py-0.5">
            <h3 className="font-bold first-letter:uppercase">{type}</h3>
            <h3 className="text-sm truncate">{name}</h3>
        </div>
    <div className={`w-full aspect-video flex justify-end items-end-safe transition-colors duration-300 p-2 rounded-sm relative`}>
         {theme !== null && <span className={`text-xs z-50 ${theme === "custom" ? "bg-purple-500/20":"bg-pirrot-blue-50"} p-1`}>{theme}</span>}
         <Image className="object-cover rounded" 
    src={thumbnailUrl && thumbnailUrl !== null ? thumbnailUrl : "/default.png"}
    priority={false}
    onError={handleImageError} 
    alt={name}
    sizes="420"
    fill 
/>
   </div>
 </div>
    </>
}