"use client"

import { useEffect, useState } from "react"
import { MapPolygon } from "@/components/ui/map"

type Coords = [number, number] // [lat, lng]

type FeatureCollection = {
  type: "FeatureCollection"
  features: Array<{
    type: "Feature"
    properties: Record<string, any>
    geometry: {
      type: "Polygon" | "MultiPolygon"
      coordinates: number[][][] | number[][][][]
    }
  }>
}

// Converte anéis [lng,lat] -> [lat,lng]
function toLatLngRings(
  geometry: FeatureCollection["features"][number]["geometry"]
): Coords[][] {
  if (!geometry) return []

  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates as number[][][]
    return rings.map((ring) => 
      ring.map(([lng, lat]) => [lat, lng] as Coords)
    )
  }

  if (geometry.type === "MultiPolygon") {
    const polys = geometry.coordinates as number[][][][]
    // junta todos os anéis dos polígonos num único array (preserva buracos)
    return polys.flatMap((poly) => 
      poly.map((ring) => 
        ring.map(([lng, lat]) => [lat, lng] as Coords)
      )
    )
  }

  return []
}

interface SpBoundaryProps {
  /**
   * Data source do GeoJSON:
   * - "full":  "/geo/br_sp.json" (arquivo completo)
   * - "light": "/geo/br_sp_simplified.json" (versão simplificada 3%)
   */
  variant?: "full" | "light"
  pathOptions?: {
    color?: string
    weight?: number
    opacity?: number
    fillColor?: string
    fillOpacity?: number
    dashArray?: string
    lineJoin?: "miter" | "round" | "bevel" | "inherit"
    lineCap?: "butt" | "round" | "square" | "inherit"
  }
}

export default function SpBoundary({
  variant = "light",
  pathOptions = {
    color: "hsl(182,100%,54%)",
    weight: 3,
    opacity: 1,
    fillColor: "hsl(182,100%,54%)",
    fillOpacity: 0.06,
    dashArray: "0",
    lineJoin: "round",
    lineCap: "round",
  },
}: SpBoundaryProps) {
  const [rings, setRings] = useState<Coords[][]>([])

  const url = variant === "light" ? "/geo/br_sp_simplified.json" : "/geo/br_sp.json"

  useEffect(() => {
    fetch(url)
      .then((r) => r.json())
      .then((data: FeatureCollection) => {
        const feature = data.features?.[0]
        if (!feature) return
        const latLngRings = toLatLngRings(feature.geometry)
        setRings(latLngRings)
      })
      .catch((e) => console.error("Erro ao carregar GeoJSON de SP:", e))
  }, [url])

  if (!rings.length) return null

  return (
    <>
      {rings.map((ring, idx) => (
        <MapPolygon key={idx} positions={ring as unknown as [number, number][]} pathOptions={pathOptions} />
      ))}
    </>
  )
}

