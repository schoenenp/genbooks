
/* stable address-form component – never re-created */
export const AddressForm = ({
    state,
    setter,
    title,
  }: {
    state: {
      org: string
      title: string
      prename: string
      name: string
      street: string
      streetNr: string
      city: string
      zip: string
      email:string
      phone?:string
      optional?: string
    }
    setter: (patch: Partial<typeof state>) => void
    title: string
  }) => (
    <form className="flex flex-1 w-full flex-col gap-2 text-sm justify-center items-center bg-pirrot-blue-50 rounded border border-pirrot-blue-500/5 p-4 pl-24">
    <div className="flex flex-col gap-2 w-full">
      <h3 className="font-bold font-cairo">{title}</h3>
  
      <div className="w-full flex flex-col gap-1 text-info-950">
              <label className="font-bold font-cairo" htmlFor="org">
                Organisation
              </label>
              <input
                id="org"
                className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2"
                placeholder="Schule oder Einrichtung"
                value={state.org}
                onChange={(e) => setter({ org: e.target.value })}
              />
            </div>
      <div className="flex gap-1 w-full">
        <Input
          small
          label="Titel"
          placeholder="Prof."
          value={state.title}
          onChange={(e) => setter({ title: e.target.value })}
        />
        <Input
          label="Vorname"
          placeholder="Max"
          value={state.prename}
          onChange={(e) => setter({ prename: e.target.value })}
        />
        <Input
          label="Name"
          placeholder="Mustermann"
          value={state.name}
          onChange={(e) => setter({ name: e.target.value })}
        />
      </div>
  
      <div className="flex gap-1 w-full">
        <Input
          label="Straße"
          placeholder="Hauptstraße"
          value={state.street}
          onChange={(e) => setter({ street: e.target.value })}
        />
        <Input
          small
          label="Hausnr."
          placeholder="123"
          value={state.streetNr}
          onChange={(e) => setter({ streetNr: e.target.value })}
        />
      </div>
  
      <div className="flex gap-1 w-full">
        <Input
          label="PLZ"
          placeholder="12345"
          value={state.zip}
          onChange={(e) => setter({ zip: e.target.value })}
        />
        <Input
          label="Stadt"
          placeholder="Musterstadt"
          value={state.city}
          onChange={(e) => setter({ city: e.target.value })}
        />
      </div>
      <div className="w-full flex flex-col gap-1 text-info-950">
              <label className="font-bold font-cairo" htmlFor="optional">
                Optional
              </label>
              <input
                id="optional"
                className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2"
                placeholder="Addresszusatz, z.B. 3.OG, Campus 1C, Sekretäriat, etc ..."
                value={state.optional}
                onChange={(e) => setter({ optional: e.target.value })}
              />
            </div>
    </div>
      <div className='flex flex-col lg:flex-row gap-2 w-full'>

             
      <div className="w-full flex flex-col gap-1 text-info-950">
        <label className="font-bold font-cairo" htmlFor="email">
          E-Mail
        </label>
        <input
          id="email"
          type="email"
          className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2"
          placeholder="max@example.com"
          value={state.email}
          onChange={(e) => setter({ email: e.target.value })}
        />
      </div>

      <div className="w-full flex flex-col gap-1 text-info-950">
        <label className="font-bold font-cairo" htmlFor="phone">
          Telefon (optional)
        </label>
        <input
          id="phone"
          type="tel"
          className="bg-pirrot-blue-950/5 w-full rounded border border-white/50 p-2"
          placeholder="0123 456789"
          value={state.phone}
          onChange={(e) => setter({ phone: e.target.value })}
        />
      </div>
      </div>
   
  
</form>
  )
  
  /* stable input helper */
  const Input = ({
    small = false,
    label,
    value,
    placeholder,
    onChange,
    type = 'text',
  }: {
    small?: boolean,
    label: string
    value: string
    placeholder: string
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    type?: string
  }) => (
    <label className={`flex flex-col ${small ? "w-16" : 'w-full'}`}>
      <span className="font-bold font-cairo">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value ?? ''}
        onChange={onChange}
        className={`bg-pirrot-blue-950/5 rounded border border-white/50 p-2`}
      />
    </label>
  )