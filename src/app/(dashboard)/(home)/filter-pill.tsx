"use client"

/* Pílula animada do filtro de competições (framer-motion), carregada sob
   demanda para não pesar o bundle inicial da home do clipador. */

import { motion } from "framer-motion"

export default function FilterPill({ className }: { className: string }) {
  return (
    <motion.span
      layoutId="competition-filter-pill"
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 40,
      }}
      className={className}
    />
  )
}
