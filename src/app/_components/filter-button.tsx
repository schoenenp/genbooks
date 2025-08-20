import { BookImage, Calendar, FilterX, Shell } from "lucide-react";

export type FilterItem = {
    id: string;
    isComplete: boolean;
    filterValue: string;
    icon?: React.ReactNode
  };

interface FilterButtonProps {
    item: FilterItem;
    isActive: boolean;
    onToggle: () => void;
  }
  
export  function FilterButton({ item, isActive, onToggle }: FilterButtonProps) {
    switch (item.id) {
      case "Wochenplaner":
        item.icon = <Calendar />
        break;
      case "Bindungen":
        item.icon = <Shell />
        break;
      case "Umschläge":
        item.icon = <BookImage />
        break;
    
      default:
        break;
    }

    return (
      <button
        type="button"
        onClick={onToggle}
        className={`hover:bg-pirrot-blue-100/50 relative flex gap-2 flex-1 cursor-pointer rounded border w-full p-1 md:px-4 md:py-2 transition-colors duration-500 hover:animate-pulse justify-center items-center ${
          item.isComplete
            ? "border-pirrot-green-300/50 bg-pirrot-green-100/50 text-info-950"
            : "bg-pirrot-blue-50 text-info-950 border-white/50"
        } `}
      >
        {item.icon}
        <span className="hidden md:block">{item.id}</span> 
        {isActive && <FilterX className="absolute top-2 right-2 size-4" />}
      </button>
    );
  }