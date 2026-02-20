'use client'
import type { ReactNode } from "react"
import useEmblaCarousel from "embla-carousel-react"
import Autoplay from "embla-carousel-autoplay"
import type { ModulePickerItem } from "./module-item"
import ModuleCarouselItem from "./module-carousel-item"
import type { ConfigModules } from "@/hooks/use-module-state"
import type { ConfigBookPart } from "./book-config"

interface ModuleCarouselProps {
  title: string
  description: string
  icon: ReactNode
  modules: ModulePickerItem[]
  onPickedItem: (pickedItem: { id: string; type: string }) => void
  pickedModules: ConfigModules
  getBookPart: (type: string) => ConfigBookPart
  autoplayDelay?: number
  borderColor?: string
  bgColor?: string
  iconColor?: string
  filter?: (module: ModulePickerItem) => boolean
  slice?: { start?: number; end?: number }
}

export default function ModuleCarousel({
  title,
  description,
  icon,
  modules,
  onPickedItem,
  pickedModules,
  getBookPart,
  autoplayDelay = 5000,
  borderColor = "border-pirrot-blue-500/5",
  bgColor = "bg-pirrot-blue-300/10",
  iconColor = "",
  filter,
  slice
}: ModuleCarouselProps) {
  const [carouselRef] = useEmblaCarousel({ 
    dragFree: true,
    align: "center"
  }, [
    Autoplay({ playOnInit: true, delay: autoplayDelay }),
  ])

  // Apply filter and slice if provided
  let filteredModules = modules
  if (filter) {
    filteredModules = modules.filter(filter)
  }
  if (slice) {
    const start = slice.start ?? 0
    const end = slice.end ?? filteredModules.length
    filteredModules = filteredModules.slice(start, end)
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex justify-between items-center py-8">
        <div className="flex flex-col gap-2 p-1">
          <h3 className={`text-2xl font-bold ${iconColor}`}>{title}</h3>
          <p className="w-full max-w-xl">{description}</p>
        </div>
        <div className="flex flex-col gap-2">
          <div className={iconColor}>{icon}</div>
        </div>
      </div>
      
      <div className={`content-card overflow-hidden ${borderColor} ${bgColor} py-12`} ref={carouselRef}>
        <div className="flex touch-pan-y touch-pinch-zoom">
          {filteredModules.map((m) => (
            <ModuleCarouselItem
              key={m.id}
              isPicked={pickedModules[getBookPart(m.type)]?.includes(m.id)}
              item={m}
              onPickedItem={onPickedItem}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
