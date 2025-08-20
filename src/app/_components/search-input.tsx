import { XIcon } from "lucide-react";

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    onClear: () => void;
  }
  
  export function SearchInput({ value, onChange, onClear }: SearchInputProps) {
    return (
      <div className="bg-pirrot-blue-50 flex flex-col gap-2 p-1">
        <div className="flex justify-between">
          <h3 className="font-bold">Modulsuche</h3>
          <button type="button" onClick={onClear}>
            <XIcon />
          </button>
        </div>
        <input
          onChange={(e) => onChange(e.target.value)}
          className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-1"
          placeholder="Suchbegriff eingeben."
          value={value}
        />
      </div>
    );
  }