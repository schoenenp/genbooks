'use client'
import TooltipFader from "@/app/_components/tooltip-fader";
import Link from "next/link";
import { AlertTriangle, CircleQuestionMark, XIcon, } from "lucide-react";
import FileUpload from "../file-upload";
import { api } from "@/trpc/react";
import { useState } from "react";
import { fileToBase64, validatePDFUpload } from "@/util/pdf/functions";
import type { BookPart } from "@prisma/client";
import ModuleItem, { type ModulePickerItem } from "@/app/_components/module-item";
import { getPageRules } from "@/util/book/functions";
import LoadingSpinner from "@/app/_components/loading-spinner";
import type { ConfigModules } from "@/hooks/use-module-state";

export default function UserModules({
  bookId,
  existingTips,
  onPickedUserItem,
  pickedModules,
  userModules
}: {
  bookId: string;
  existingTips: string[]
  onPickedUserItem: (pickedItem: { id: string; type: string; }) => void;
  pickedModules: ConfigModules
  userModules: ModulePickerItem[]
}) {

  const [moduleFormError, setModuleFormError] = useState<string | undefined>()

  const [moduleFormState, setModuleFormState] = useState({
    name: "",
    type: "sonstige",
    moduleFile: null as File | null
  })



  const { data: customTypeItems } = api.type.getCustomTypes.useQuery()


  const utils = api.useUtils()
  const { mutate: createModule, isPending } = api.module.create.useMutation({
    onSuccess: async () => {
      await utils.module.getUserModules.invalidate()
      await utils.config.init.invalidate({bookId})
    }
  })



  function handleCloseError() {
    setModuleFormError(undefined)
    setModuleFormState({
      ...moduleFormState,
      moduleFile: null
    })
  }

  async function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (!moduleFormState.moduleFile) {
      return
    }
    const fileToUpload = await fileToBase64(moduleFormState.moduleFile)

    const { valid, message } = await validatePDFUpload(
      fileToUpload,
      moduleFormState.type.toLocaleUpperCase() as BookPart
    )

    if (valid) {
      createModule({
        name: moduleFormState.name,
        type: moduleFormState.type,
        moduleFile: fileToUpload
      })
    } else {
      setModuleFormError(message)
    }
  }


  function handlePickedItem(pickedItem: {
    id: string;
    type: string;
  }) {
    onPickedUserItem(pickedItem)
  }

  return <div className="bg-purple-300/10 border rounded border-purple-500/5 p-1 lg:px-4 py-16">
    <div className="flex flex-wrap w-full">
      {moduleFormError || isPending ? <div onClick={handleCloseError} className="p-1 lg:p-4 bg-pirrot-blue-50 w-full aspect-video lg:py-16 rounded relative  flex justify-center items-center flex-col">
        {moduleFormError && <button onClick={handleCloseError} className="absolute top-2 right-2"><XIcon className="size-6" /></button>}
        {moduleFormError}
        {isPending && <LoadingSpinner />}
      </div> : <div className="w-full grid grid-cols-1 lg:grid-cols-2 p-1 lg:p-4 bg-pirrot-blue-50  lg:py-16 rounded gap-4">
        <div className="flex w-full flex-col gap-2">
          <h5 className="text-2xl font-bold underline">Erstellen von Modulen</h5>
          <p className="text-sm w-full max-w-64">Bitte hängen Sie Ihre PDF-Dateien diesem Formular an, um sie für den Planer zu übernehmen.</p>

        </div>

        <div className="p-2 flex flex-col gap-2 bg-purple-50/20 border-purple-100 border rounded">
          <h5 className="text-2xl font-bold flex gap-2 items-center"><AlertTriangle /> Hinweis</h5>
          <p className="text-sm w-full">Erstellte Module sind grundsätzlich privat und nur für Sie einsehbar. Sie haben jedoch die Option, diese Module in Ihrem Nutzerbereich für alle öffentlich zu machen. Beachten Sie hierbei bitte die Allgemeinen Geschäftsbedingungen (AGBs) unserer Webseite.</p>
        </div>
        <div className="flex-1 aspect-video">
          <FileUpload
            fieldName="custom-upload"
            resetFile={() => setModuleFormState({
              ...moduleFormState,
              moduleFile: null
            })}
            onPickedFile={(e) => setModuleFormState({
              ...moduleFormState,
              moduleFile: e
            })}
          />
        </div>
        <form onSubmit={handleFormSubmit} className="basis-1/2 inset-shadow-sm inset-shadow-purple-950/5 bg-purple-300/5 border-info-100 p-2 pt-8 border rounded overflow-y-auto flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Modul name</label>
            <input
              placeholder="Beispiel Titel"
              className="w-full p-2 text-xl bg-pirrot-blue-50/50 border border-pirrot-blue-50 rounded"
              value={moduleFormState.name}
              onChange={
                (e) => setModuleFormState({
                  ...moduleFormState,
                  name: e.target.value
                })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Teil des Buches</label>
            <select className="w-full p-2 text-xl bg-pirrot-blue-50/50 border border-pirrot-blue-50 rounded" value={moduleFormState.type} onChange={(e) => setModuleFormState({ ...moduleFormState, type: e.target.value })}>
              {customTypeItems?.map((t) => <option
                id={t.name}
                key={t.id}
                value={t.name}

              >
                {t.name}
                {" | "}
                {getPageRules({ min: t.min, max: t.max })} Seiten
              </option>)}
            </select>
          </div>
          <div>

          </div>
          <div>
            <button disabled={isPending} type="submit" className="bg-info-300/50 hover:bg-info-300/70  border disabled:opacity-30 p-2 px-4 rounded border-info-100/50 transition duration-300 cursor-pointer font-medium">Speichern</button>
          </div>
        </form>
      </div>}
      <div className="flex w-full flex-col lg:flex-row p-4 py-16 gap-4 justify-between">
        <div className="flex-1 w-full flex h-full flex-col gap-4 justify-between">

          <div className="flex flex-col  gap-2">
            <h5 className="text-2xl font-bold underline">User Module</h5>
            <p className="text-sm w-full max-w-64">Hier werden Ihre eigenen Module angezeigt. Custom Module können im <Link href="/dashboard?view=module" className="font-medium text-pirrot-red-400">Dashboard</Link> bearbeitet werden.</p>
          </div>
          {userModules.length === 0 ? <div className="flex size-full bg-purple-100/50 p-2 rounded text-center items-center justify-center border shadow-2xs border-purple-500/10 flex-col gap-2">
            <h5 className="text-2xl font-bold uppercase">Module erstellen</h5>
            <p className="text-sm w-full max-w-64">Module Erstellen und dem Planer hinzufügen. Ihre Dokumente werden hier angezeigt.</p>
          </div> 
          :    
          <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[420px] overflow-y-auto border-b border-purple-300/20 py-4">
            {userModules?.map((m, i) => <ModuleItem
              key={i}
              item={m}
              isPicked={pickedModules.MODULES.includes(m.id)
                || pickedModules.COVER.includes(m.id)}
              onPickedItem={handlePickedItem}
            />)}
          </div>}
        </div>



        <div className="border-t lg:border-l lg:border-t-0 border-info-950/20 py-8 lg:pl-8 lg:py-0 h-full flex w-full lg:w-auto flex-col lg:items-center gap-8">
          <div className="flex flex-col gap-2">
            <h5 className="font-bold text-2xl flex gap-2 items-center "><CircleQuestionMark /> Tooltips</h5>
            <p className="text-sm w-full max-w-48">Hier ein paar schnelle Tipps für Sie. Mehr infos erhalten Sie in unserem <Link href="#info-center" className="font-medium text-pirrot-red-400">Hilfe-Center</Link>.</p>
          </div>
          <TooltipFader tooltips={existingTips} />

        </div>
      </div>
    </div>
  </div>
}