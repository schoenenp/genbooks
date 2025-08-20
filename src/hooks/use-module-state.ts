
import type { BookFormat } from "@/util/book/formats";
import type { BookPart } from "@prisma/client";
import { useState } from "react";

export type ConfigModules = {
    COVER: string[];
    MODULES: string[];
    SETTINGS: string[];
  };

  type InitialModuleItem = {
    id:string;
    idx: number;
    part: BookPart;
    color?: number;
  }
export function useModuleState(initialBook?: { 
  name?: string | null;
  modules?: InitialModuleItem[];
}) {



 
    const [ previewPrice,setPreviewPrice] = useState<{
      single:number;
      total: number;
    }>({ single: 200, total: 200})
    const [orderAmount,setOrderAmount] = useState<number>(1)
    const [nameInput, setNameInput] = useState<string | null>(
      initialBook?.name ?? null)
    
      function makeInitialModules(moduleItems:InitialModuleItem[]):ConfigModules{ 
        const configModuleStart = {
        COVER: [] as string[],
        MODULES: [] as string[],
        SETTINGS: [] as string[],
      }
    
      for (const item of moduleItems) {
        switch (item.part) {
          case 'COVER':
            configModuleStart.COVER.push(item.id);
            break;
          case 'BINDING':
            configModuleStart.SETTINGS.push(item.id);
            break;
          case 'DEFAULT':
          case 'PLANNER':
          case 'SETTINGS':
          default:
            configModuleStart.MODULES.push(item.id);
            break;
        }
      }
    
      return configModuleStart;
        }

        const initialModules = makeInitialModules(initialBook?.modules ?? [])

    const [pickedModules, setPickedModules] = useState<ConfigModules>(initialModules);

    // const DinA5 = {
    //   name:"A5",
    //   type:"DIN",
    //   dimensions:{
    //       x: 148,
    //       y: 210
    //   },
    // } as BookFormat

  
    const [pickedFormat, setPickedFormat] = useState<"DIN A5" | "DIN A4">("DIN A5");
    const [totalPagesCount, setTotalPagesCount] = useState(0);
    const [isMakingPreview, setIsMakingPreview] = useState(false)

    return {
      nameInput,
      setNameInput,
      pickedFormat,
      setPickedFormat,
      pickedModules,
      setPickedModules,
      totalPagesCount,
      setTotalPagesCount,
      isMakingPreview,
      setIsMakingPreview,
      previewPrice,
      setPreviewPrice,
      orderAmount,
      setOrderAmount,
    };
  }