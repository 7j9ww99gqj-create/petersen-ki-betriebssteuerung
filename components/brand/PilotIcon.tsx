'use client'
// Additiver Icon-Wrapper auf Basis von lucide-react.
// Wird parallel zu den bestehenden Emoji-Icons angeboten — nichts wird ersetzt.
// Verwendung: <PilotIcon name="lager" size={20} /> oder <PilotIcon name="buero" />.
import {
  Box,
  Briefcase,
  Wrench,
  Megaphone,
  BarChart3,
  CalendarRange,
  Receipt,
  Brain,
  CloudCog,
  Archive,
  Settings,
  ShieldCheck,
  Sparkles,
  Search,
  Bell,
  Home,
  Menu,
  Truck,
  ClipboardList,
  FileText,
  Users,
  Tag,
  type LucideProps,
} from 'lucide-react'

export type PilotIconName =
  | 'lager'
  | 'buero'
  | 'werkstatt'
  | 'marketing'
  | 'analyse'
  | 'planung'
  | 'steuer'
  | 'ki'
  | 'cloud'
  | 'archiv'
  | 'einstellungen'
  | 'qm'
  | 'pondruff'
  | 'suche'
  | 'glocke'
  | 'start'
  | 'menue'
  | 'wareneingang'
  | 'auftrag'
  | 'beleg'
  | 'kunden'
  | 'preis'

const MAP: Record<PilotIconName, React.ComponentType<LucideProps>> = {
  lager: Box,
  buero: Briefcase,
  werkstatt: Wrench,
  marketing: Megaphone,
  analyse: BarChart3,
  planung: CalendarRange,
  steuer: Receipt,
  ki: Brain,
  cloud: CloudCog,
  archiv: Archive,
  einstellungen: Settings,
  qm: ShieldCheck,
  pondruff: Sparkles,
  suche: Search,
  glocke: Bell,
  start: Home,
  menue: Menu,
  wareneingang: Truck,
  auftrag: ClipboardList,
  beleg: FileText,
  kunden: Users,
  preis: Tag,
}

export interface PilotIconProps extends Omit<LucideProps, 'ref'> {
  name: PilotIconName
}

export function PilotIcon({ name, size = 18, strokeWidth = 1.75, ...rest }: PilotIconProps) {
  const Cmp = MAP[name]
  if (!Cmp) return null
  return <Cmp size={size} strokeWidth={strokeWidth} aria-hidden {...rest} />
}

export default PilotIcon
