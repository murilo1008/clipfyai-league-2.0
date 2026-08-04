import { Instagram, Youtube } from "@/lib/icons"
import { TikTokIcon } from "@/components/icons/tiktok-icon"
import { KwaiIcon } from "@/components/icons/kwai-icon"
import { FacebookIcon } from "@/components/icons/facebook-icon"

export const platformConfig = {
  INSTAGRAM: {
    icon: Instagram,
    label: "Instagram",
    color: "text-pink-400",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/30",
  },
  TIKTOK: {
    icon: TikTokIcon,
    label: "TikTok",
    color: "text-[#f1204a]",
    bgColor: "bg-[#f1204a]/10",
    borderColor: "border-[#f1204a]/30",
  },
  YOUTUBE: {
    icon: Youtube,
    label: "YouTube",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
  },
  KWAI: {
    icon: KwaiIcon,
    label: "Kwai",
    color: "text-[#ff7705]",
    bgColor: "bg-[#ff7705]/10",
    borderColor: "border-[#ff7705]/30",
  },
  FACEBOOK: {
    icon: FacebookIcon,
    label: "Facebook",
    color: "text-[#1877f2]",
    bgColor: "bg-[#1877f2]/10",
    borderColor: "border-[#1877f2]/30",
  },
} as const

export type PlatformKey = keyof typeof platformConfig

