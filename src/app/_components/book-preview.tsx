import Image from "next/image"

type BookPreviewProps = {
    name?: string;
    bg?: string;
    sub?: string;
    period: {
        start: string,
        end: string,
    }
}

export default function BookPreview(props : BookPreviewProps) {
    const { name, period, sub } = props
    const from = new Date(period.start).getFullYear()
    const to = new Date(period.end).getFullYear()
    return <div className="flex"> 
    
    <div className="aspect-5/7 w-3xs bg-gradient-to-br from-pirrot-blue-500 to-pirrot-blue-700 rounded-l-md rounded-r-sm border-l-4 flex flex-col pt-16 border border-pirrot-blue-200 items-center border-l-pirrot-blue-950 border-b-2 border-r-2 animate-float drop-shadow-lg drop-shadow-pirrot-blue-950/35 relative z-[1]">
    <i className="absolute h-full top-0 -left-4 py-3 flex flex-col justify-between items-center gap-4">
{Array.from({length:19}).map((_, idx) => <b key={idx}  className="w-6 rounded-full h-1 bg-white z-[1]"></b>) }
    </i>
    <div className="z-1 bg-pirrot-blue-950/80 rounded border-2 border-pirrot-blue-900/50 p-2 w-3/4 flex flex-col gap-1.5">
    <div className="flex flex-col">
        <h5 className=" z-[1] font-bold text-base">{name}</h5>
        <p className="z-[1] text-xs font-bold">{from === to 
      ? `${from}`
      : `${from}/${to}`}</p>
    </div>
        <h5 className="z-[1] w-full text-wrap text-xs">{sub}</h5>
    </div>
    <Image className="z-0" fill src="/assets/wood.png" alt="background" />
    </div>

    </div>
}