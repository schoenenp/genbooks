'use client'
type ColorProfileItem = {
  page: number;
  c: number; 
  m: number;
  y: number;
  k: number;
  type:string;
}

type PreflightResult = {
    file_name: string;
    page_count:number;
    has_formfields: boolean
    colorProfiles: ColorProfileItem[]
}

export async function preflightDocument(
    pdfBlob: Blob
): Promise<PreflightResult> {
    const formData = new FormData()
    formData.append('file', pdfBlob, "preflight_document.pdf")

    let result = {} as PreflightResult
    try{
      const response = await fetch('http://142.132.164.40:9001/document/preflight', {
        method: 'POST',
        body: formData,
      });
      result = await response.json() as PreflightResult
    }catch(err){
      console.log(err)
    }

  return result
}