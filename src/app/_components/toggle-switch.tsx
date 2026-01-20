import { motion } from "framer-motion";
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <div className="flex w-full flex-wrap justify-between p-1">
      <h3>{label}</h3>
      <motion.div
        onClick={() => onChange(!checked)}
        className={`flex w-10 cursor-pointer items-center rounded-full border border-white/50 ${checked ? "bg-pirrot-green-300" : "bg-pirrot-blue-50"}`}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <motion.div
          className="bg-info-950 size-5 rounded-full"
          animate={{ x: checked ? 18 : 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 15,
            mass: 0.5,
          }}
        />
      </motion.div>
    </div>
  );
}
