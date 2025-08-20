'use client'
import { Reorder } from "framer-motion"
import { BookImage, CalendarDays, GripVertical, ShellIcon, XIcon } from "lucide-react";
import type { ConfigModules } from "@/hooks/use-module-state";

import { useEffect, useState } from "react";
import type { BookPart } from "@prisma/client";

type ModuleItem = {
    id: string;
    name: string;
    type: string;
    theme: string | null;
    thumbnail: string;
}

export type ModuleId = ModuleItem["id"]
export type ColorCode = 4 | 1
 type ModuleChangerItem = {
    id: string;
    name: string;
    theme: string | null;
    part: BookPart;
    type: string;
    thumbnail: string;
    url: string;
    creteadAt: Date;
    booksCount: number;
 }

export default function ModuleChanger(props:{ 
  items: ConfigModules
  modules: ModuleChangerItem[]
  onItemsChange?: (newItems: ConfigModules) => void
  onColorMapChange: (colorMap: Map<ModuleId, ColorCode>) => void
  initialColorMap: Map<ModuleId, ColorCode>
}){

    const {modules} = props
    // Get the modules for each section
    const coverItem = modules.find(m => m.id === props.items.COVER[0])
    const bindingItem = modules?.find(m => m.id === props.items.SETTINGS[0])

    const [colorMap, setColorMap] = useState<Map<ModuleId, ColorCode>>(props.initialColorMap)
  
    useEffect(() => {
        props.onColorMapChange(colorMap);
      }, [colorMap, props]);
      
    
      function handleColorChange(moduleId: ModuleId, color: ColorCode) {
        setColorMap(prev => {
          const newMap = new Map(prev);
          newMap.set(moduleId, color);
          return newMap;
        });
      }
    
    const createOrderedItems = () => {
      const allItems: (ModuleItem & { itemType: 'module' | 'planner' })[] = [];
      
      // Add all items in order
      props.items.MODULES.forEach(itemId => {
          const item = modules.find(m => m.id === itemId);
          if (item) {
              allItems.push({ 
                  ...item, 
                  itemType: item.type.toLowerCase() === 'wochenplaner' ? 'planner' : 'module' 
              });
          }
      });
      
      return allItems;
  };
    
    const orderedItems = createOrderedItems();

    const contentModuleIds = orderedItems.map(item => item.id);
    const contentColors = contentModuleIds.map(id => colorMap.get(id) ?? 4);
    
    let contentIsColor: boolean | null;
    if (contentColors.every(c => c === 4)) {
      contentIsColor = true;
    } else if (contentColors.every(c => c === 1)) {
      contentIsColor = false;
    } else {
      contentIsColor = null;
    }
    
    function handleRemoveItem(
      id: string, 
      type: 'COVER' | 'MODULES' | 'SETTINGS'
    ){
      if (!props.onItemsChange) return;
      
      const newItems = {
          ...props.items,
          [type]: props.items[type].filter(itemId => itemId !== id)
      };
      props.onItemsChange(newItems);
    }
    
    function handleReorder(newOrder: string[]) {
      if (!props.onItemsChange) return;
      
      const moduleItems = newOrder
      
      props.onItemsChange({
          ...props.items,
          MODULES: moduleItems,
      });
  }


    function createReorderableItem(item: ModuleItem & { itemType: 'module' | 'planner' }) {
        const isPlannerItem = item.itemType === 'planner';
   
        return (
            <Reorder.Item key={item.id} value={item.id}>
                <div className="py-0.5">
                    <div className={`w-full cursor-grab p-2 rounded text-info-950 flex gap-2 items-center border  ${
                        isPlannerItem ? 'bg-pirrot-blue-50 border-2 border-pirrot-green-300' : 'bg-pirrot-blue-50 border-white/50'
                    }`}>
                        <div className="size-12 flex justify-center items-center p-0.5">
                        {isPlannerItem ? <CalendarDays className="text-pirrot-green-300" /> : <GripVertical />}    
                        </div>
                        <div className="flex flex-col w-full text-base">
                            <h5 className={`${isPlannerItem && "text-pirrot-green-700"} text-sm font-bold`}>
                            {item.name}
                            </h5>
                            <span className="text-xs">{item.theme}</span>
                            <span className="text-xs font-semibold">{item.type}</span>
                        </div>
                        <ModuleColorChanger 
                              moduleId={item.id}
                              currentColor={colorMap.get(item.id) ?? 4}
                              onColorChange={handleColorChange}
                        />
                        <div className="size-12 flex justify-center items-center p-0.5">
                            <button 
                                type="button"
                                onClick={() => handleRemoveItem(item.id, 'MODULES')}
                            >
                                <XIcon />
                            </button>
                        </div>
                    </div>
                </div>
            </Reorder.Item>
        )
    }

    function setAllModuleColors(color: ColorCode) {
        setColorMap(prev => {
          const newMap = new Map(prev);
          orderedItems.forEach(item => {
            newMap.set(item.id, color);
          });
          return newMap;
        });
      }

    function createStaticItem(item: ModuleItem, type: 'COVER' | 'SETTINGS') {
        const staticIcon = (itemType:string) => {
                switch (itemType) {
                    case 'COVER':
                        return <BookImage className="size-6" />
                    case 'SETTINGS':
                        return <ShellIcon className="size-6" />
                    default:
                        break;
                }
        } 

        
        return (
            <div className="py-0.5 my-1" key={item.id}>
                <div className={`w-full p-2 bg-pirrot-blue-50 border-2 rounded
                    ${type === "COVER" && `
                    border-pirrot-blue-300 text-pirrot-blue-950`}
                    ${type === "SETTINGS" && `
                    border-warning-300 text-warning-700`}
                     flex gap-2 items-center`}>
                    <div className="size-12 flex justify-center items-center p-0.5">
                        {staticIcon(type)}
                    </div>
                    <div className="flex flex-col w-full text-base">
                        <h5 className="text-sm font-bold">{item.name}</h5>
                        <span className="text-xs text-info-950">{item.theme}</span>
                    </div>
                    {type !== "SETTINGS" && <ModuleColorChanger 
                              moduleId={item.id}
                              currentColor={colorMap.get(item.id) ?? 4}
                              onColorChange={handleColorChange}
                        />}
                    <div className="size-12 flex justify-center items-center p-0.5">
                        <button 
                            type="button"
                            onClick={() => handleRemoveItem(item.id, type)}
                            className="text-info-950"
                        >
                            <XIcon />
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2">
            <h2>BUCH AUFBAU</h2>
            
            {/* COVER - Static (not reorderable) */}
            <div className="mb-2 flex flex-col gap-1">
                <h3 className="text-sm font-semibold mb-1">Umschlag</h3>
                {coverItem ? createStaticItem(coverItem, 'COVER') : (
                    <div className="w-full p-4 bg-pirrot-blue-50/80 rounded my-1">
                        Kein Umschlag ausgewählt.
                    </div>
                )}
            </div>

            {/* MODULES + PLANNER - All reorderable together */}
            <div className="mb-2 flex flex-col gap-1">
</div>
<div className="flex justify-between">
<h3 className="text-sm font-semibold mb-1">Inhalt (Module & Planer)
</h3>
                </div>
                <div className="flex gap-2">
                    <button 
                        type="button" 
                        onClick={() => setAllModuleColors(1)} 
                        className={`flex-1 p-1 border rounded bg-pirrot-blue-50 ${contentIsColor !== null && !contentIsColor ? "border-pirrot-blue-700/50 border-2" : "border-white/50"}`}>S/W</button>
                    <button 
                        type="button" 
                        onClick={() => setAllModuleColors(4)}
                        className={`flex-1 p-1 border rounded bg-pirrot-blue-50 ${contentIsColor !== null &&  contentIsColor ? "border-pirrot-blue-700/50 border-2" : "border-white/50"}`}>Farbe</button>
                </div>
                {orderedItems.length === 0 ? (
                    <div className="w-full p-4 bg-pirrot-blue-50/80 rounded my-1">
                        Keine Module oder Planer ausgewählt.
                    </div>
                ) : (
                    <div className={`relative overflow-y-auto max-h-[420px]`}>
                    <Reorder.Group 
                        axis="y"
                        values={orderedItems.map(item => item.id)}
                        onReorder={handleReorder}
                        >
                        {orderedItems.map(createReorderableItem)}
                    </Reorder.Group>
                        </div>
                )}
            </div>
                {/* BINDUNG - Static (not reorderable) */}
            <div className="mb-2">
                <h3 className="text-sm font-semibold mb-1">Bindung</h3>
                {bindingItem ? createStaticItem(bindingItem, 'SETTINGS') : (
                    <div className="w-full p-4 bg-pirrot-blue-50/80 rounded my-1">
                        Keine Bindung ausgewählt.
                    </div>
                )}
            </div>
            </div>
}


type ModuleColorChangerProps = {
    moduleId: string,
    currentColor: ColorCode,
    onColorChange: (moduleId: ModuleId, color: ColorCode) => void
  }
  
  function ModuleColorChanger(props: ModuleColorChangerProps) {
    const isColor = props.currentColor === 4 

    function handleClickedItemColor(event: React.MouseEvent<HTMLButtonElement>) {
      const color = event.currentTarget.id === "color" ? 4 : 1;
      props.onColorChange(props.moduleId, color);
    }
    
    return <div className="flex flex-col gap-1 justify-center items-center text-xs">
    <button id={"s/w"} type="button" onClick={handleClickedItemColor} className={`rounded grid grid-cols-2 bg-info-100/50 p-0.5 size-5 border ${isColor ? "border-pirrot-blue-100" : "border-pirrot-blue-500/50"}`}>
    <SwCube />
    </button>
    <button id={"color"} type="button" onClick={handleClickedItemColor} className={`rounded grid grid-cols-2 bg-info-100/50 p-0.5 size-5 border ${!isColor ? "border-pirrot-blue-100" : "border-pirrot-blue-500/50"}`}>
   <ColorCube />
    </button>
</div>
}

export function ColorCube() {
    return <>
    <span className=" bg-pirrot-blue-500"></span>
    <span className=" bg-pirrot-red-400"></span>
    <span className=" bg-warning-200"></span>
    <span className=" bg-info-950"></span>
    </>
}

export function SwCube() {
    return <>
    <span className="bg-info-50"></span>
    <span className="bg-info-950"></span>
    </>
}