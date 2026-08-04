import { Suspense } from "react"

import ClipperAcademy from "./clipper-academy"

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#02080f]">
      <div className="border-brand-cyan size-12 animate-spin rounded-full border-t-2 border-b-2" />
    </div>
  )
}

export default function AcademiaClipadoraPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ClipperAcademy />
    </Suspense>
  )
}
