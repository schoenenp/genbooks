import ModuleGrid from "@/app/dashboard/module/_components/module-grid";

export default function ModulesSection () {
    return <div className="flex-1 lg:min-h-96 border border-pirrot-blue-500/5 rounded p-4 flex flex-col gap-4 relative">
    <h2 className="text-2xl uppercase font-bold">Modulübersicht</h2>
    <ModuleGrid />
        </div>
}