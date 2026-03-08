'use client'
import Image from "next/image"
import Modal from "./modal";
import { useState } from "react";
import { MinusIcon, PlusIcon, XIcon } from "lucide-react";
import ModulePreview from "./module-preview";

export type ModulePickerItem = {
  id: string;
  name: string;
  theme: string | null;
  thumbnail?: string | null;
  type: string;
  part: string;
}

export type ModuleItemProps = {
  item: ModulePickerItem;
  onPickedItem: (pickedItem: { id: string; type: string }) => void;
  isPicked: boolean;
  isDisabled?: boolean;
  disabledReason?: string;
}

export default function ModuleItem(props: ModuleItemProps) {
  const { id, thumbnail, name, theme, type } = props.item
  const [isPickingModule, setIsPickingModule] = useState(false)
  const [
    thumbnailUrl,
    setThumbnailUrl
  ] = useState(thumbnail)

  const handleImageError = () => {
    setThumbnailUrl("/default.png");
  }

  function handlePickedModule(event: React.FormEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (props.isDisabled) return
    setIsPickingModule(false)
    props.onPickedItem({ id, type })
  }

  const getIndicatorColor = (moduleType: string) => {
    switch (moduleType) {
      case "umschlag":
        return "var(--color-pirrot-blue-300)"
      case "wochenplaner":
        return "var(--color-pirrot-green-300)"
      case "bindung":
        return "var(--color-warning-300)"
      case "custom":
        return "var(--color-pirrot-red-300)"
      default:
        if (theme !== null && theme === "custom") {
          return "var(--color-pirrot-red-300)"
        }
        return "var(--color-pirrot-red-300)"
    }
  }

  const pickedStyle = props.isPicked
    ? { outline: `2px solid ${getIndicatorColor(type.toLocaleLowerCase())}` }
    : undefined

  return <>
    <Modal selector="modal-hook" show={isPickingModule && !props.isDisabled}>
      <div className="absolute top-0 left-0 z-[69] flex size-full items-center justify-center bg-info-950/90">
        <div className="content-card pointer-events-none z-[69] w-full max-w-xl p-4 text-pirrot-blue-950 font-bold">
          <form onSubmit={handlePickedModule} className="w-full flex flex-col gap-1 pointer-events-auto">
            <div className="w-full flex justify-between items-center">
              <h3 className="text-xl">{name}</h3>
              <button onClick={() => setIsPickingModule(false)} type="button" className="btn-soft p-2 text-pirrot-blue-900">
                <XIcon />
              </button>
            </div>
            <div className="field-shell flex h-full w-full items-center justify-center rounded">
              <ModulePreview moduleId={id} />
            </div>
            <div>
              {props.isPicked ? <button className="btn-soft flex w-full items-center justify-between gap-2 p-2"><MinusIcon /> Abwählen </button> : <button className="btn-solid flex w-full items-center justify-between gap-2 p-2"> <PlusIcon /> Auswählen</button>}
            </div>
          </form>
        </div>
      </div>
    </Modal>
    <div
      onClick={() => {
        if (props.isDisabled) return
        setIsPickingModule(true)
      }}
      title={props.isDisabled ? props.disabledReason : undefined}
      style={pickedStyle}
      className={`content-card stagger-item select-none relative flex min-w-0 flex-col justify-between gap-1 shadow-sm ${props.isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <div className="flex flex-col lg:flex-row justify-between gap-1 lg:gap-4 p-2">
        <h3 className="font-bold first-letter:uppercase">{type}</h3>
        <h3 className="text-sm truncate">{name}</h3>
      </div>
      {props.isDisabled && props.disabledReason ? (
        <p className="px-2 text-xl font-bold text-warning-50 absolute flex justify-center items-center bg-pirrot-blue-950/20 text-center size-full z-10 rounded-2xl">{props.disabledReason}</p>
      ) : null}
      <div className="relative flex aspect-video w-full items-end-safe justify-end rounded-[1rem] p-2 transition-colors duration-300">
        {theme !== null && <span className={`text-xs z-50 ${theme === "custom" ? "bg-purple-500/20" : "bg-pirrot-blue-50"} p-1`}>{theme}</span>}
        <Image className="rounded-[1rem] object-cover"
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
