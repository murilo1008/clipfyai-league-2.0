import { Suspense } from "react"

import Modules from "./modules"

export const metadata = {
  title: "Aulas | Clipfy Academy",
  description: "Assista aos módulos e aulas da academia de clipadores",
}

export default function ModulesPage() {
  // O player usa useSearchParams (?moduleId= / ?lessonId=) — precisa de
  // Suspense boundary no Next 15.
  return (
    <Suspense fallback={null}>
      <Modules />
    </Suspense>
  )
}
