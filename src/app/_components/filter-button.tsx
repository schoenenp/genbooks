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
        className={`relative flex w-full flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 py-2 text-sm font-semibold ${
          item.isComplete
            ? "border-pirrot-green-300/50 bg-pirrot-green-100/60 text-info-950"
            : "field-shell text-info-950"
        } `}
      >
        {item.icon}
        <span className="hidden md:block">{item.id}</span>
        {isActive && <FilterX className="absolute top-2 right-2 size-4 text-pirrot-blue-700" />}
      </button>
    );
  }
