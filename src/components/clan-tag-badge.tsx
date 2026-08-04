"use client"

import {
  Flame, Zap, Bolt, DollarSign, Star, Crown, Trophy, Medal, Gem, Sparkles,
  Heart, Shield, Swords, Target, Crosshair, Bomb, Skull, Ghost, Rocket, Moon,
  Sun, Snowflake, CloudLightning, Mountain, Leaf, TreePine, Bird, Cat, Dog,
  Fish, Bug, Anchor, Compass, Gamepad2, Joystick, Dice5, Music, Headphones,
  type LucideIcon,
} from "@/lib/icons"
import { AlligatorIcon } from "@/components/icons/alligator-icon"

export const CLAN_ICON_MAP: Record<string, LucideIcon> = {
  Flame, Zap, Bolt, DollarSign, Star, Crown, Trophy, Medal, Gem, Sparkles,
  Heart, Shield, Swords, Target, Crosshair, Bomb, Skull, Ghost, Rocket, Moon,
  Sun, Snowflake, CloudLightning, Mountain, Leaf, TreePine, Bird, Cat, Dog,
  Fish, Bug, Anchor, Compass, Gamepad2, Joystick, Dice5, Music, Headphones,
  Alligator: AlligatorIcon as unknown as LucideIcon,
}

export function getClanIcon(emoji: string): LucideIcon {
  return CLAN_ICON_MAP[emoji] ?? Shield
}

type ClanTagBadgeSize = "xs" | "sm" | "md" | "lg"

interface ClanTagBadgeProps {
  tag: string
  emoji: string
  emojiColor: string
  size?: ClanTagBadgeSize
  className?: string
}

const SIZE_CONFIG: Record<ClanTagBadgeSize, { icon: string; text: string; padding: string; font: string }> = {
  xs: { icon: "h-2.5 w-2.5 sm:h-3 sm:w-3", text: "text-[9px] sm:text-[10px]", padding: "px-2 sm:px-2.5 py-1",   font: "font-semibold" },
  sm: { icon: "h-3 w-3",                     text: "text-xs",                   padding: "px-2.5 py-1.5",          font: "font-semibold" },
  md: { icon: "h-3.5 w-3.5",                 text: "text-xs",                   padding: "px-3 py-1.5",            font: "font-bold tracking-wider" },
  lg: { icon: "h-4 w-4",                     text: "text-sm",                   padding: "px-4 py-2.5",            font: "font-bold tracking-wider" },
}

export function ClanTagBadge({ tag, emoji, emojiColor, size = "sm", className }: ClanTagBadgeProps) {
  const Icon = getClanIcon(emoji)
  const s = SIZE_CONFIG[size]

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-sm ${s.padding} ${className ?? ""}`}
      style={{ backgroundColor: "#2B2D31" }}
    >
      <Icon className={s.icon} style={{ color: emojiColor }} strokeWidth={4} />
      <span className={`${s.text} ${s.font} leading-none text-white`}>
        {tag}
      </span>
    </div>
  )
}
