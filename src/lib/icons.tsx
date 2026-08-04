/**
 * Camada de ícones da Clipfy League.
 *
 * Toda a aplicação importa ícones a partir deste módulo (`@/lib/icons`) em vez
 * de `lucide-react`. Internamente usamos a biblioteca Phosphor Icons, expondo
 * cada ícone com o nome que o restante do código já conhece (compatível com a
 * antiga nomenclatura do Lucide). Assim a migração é total e centralizada:
 * para trocar/ajustar um ícone, basta editar este arquivo.
 */
import {
  Anchor as _Anchor,
  Archive as _Archive,
  ArrowArcLeft,
  ArrowArcRight,
  ArrowBendDownRight,
  ArrowBendUpLeft,
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowDown,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  ArrowsClockwise,
  ArrowsCounterClockwise,
  ArrowsDownUp,
  ArrowsOut,
  ArrowUp,
  ArrowUpRight,
  ArrowUUpLeft,
  At,
  Bank,
  Bell,
  BellSlash,
  Bird as _Bird,
  Bomb as _Bomb,
  BookOpen as _BookOpen,
  Briefcase as _Briefcase,
  Brain as _Brain,
  Bug as _Bug,
  Buildings,
  Calendar,
  CalendarDots,
  Camera as _Camera,
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  CaretUpDown,
  Cat as _Cat,
  ChartBar,
  ChartLine,
  ChartPie,
  ChatCircle,
  ChatText,
  Check,
  CheckCircle,
  Checks,
  CircleNotch,
  Circle as _Circle,
  ClipboardText,
  Clock as _Clock,
  CloudLightning as _CloudLightning,
  Coins as _Coins,
  Compass as _Compass,
  Confetti,
  Cookie as _Cookie,
  Copy as _Copy,
  Copyright as _Copyright,
  CreditCard as _CreditCard,
  Crosshair as _Crosshair,
  Crown as _Crown,
  CurrencyDollar,
  Database as _Database,
  DeviceMobile,
  DeviceTablet,
  Diamond,
  DiceFive,
  Dog as _Dog,
  DotsSixVertical,
  DotsThree,
  DotsThreeVertical,
  DownloadSimple,
  Envelope,
  Eye as _Eye,
  EyeSlash,
  FacebookLogo,
  FileArrowDown,
  FilePdf,
  FileText as _FileText,
  FileVideo as _FileVideo,
  FileX,
  FileXls,
  FilmSlate,
  FilmStrip,
  Fire,
  Fish as _Fish,
  FloppyDisk,
  FolderOpen as _FolderOpen,
  FolderPlus,
  Funnel,
  GameController,
  Gauge as _Gauge,
  Gavel as _Gavel,
  Gear,
  Ghost as _Ghost,
  Gift as _Gift,
  Globe as _Globe,
  GraduationCap as _GraduationCap,
  GridFour,
  HandCoins as _HandCoins,
  Handshake as _Handshake,
  HardDrives,
  Hash as _Hash,
  Headphones as _Headphones,
  Heart as _Heart,
  House,
  IdentificationCard,
  Image as _Image,
  Info as _Info,
  InstagramLogo,
  Joystick as _Joystick,
  Key,
  Leaf as _Leaf,
  Lightbulb as _Lightbulb,
  Lightning,
  Link as _Link,
  LinkSimple,
  List,
  Lock as _Lock,
  MagicWand,
  MagnifyingGlass,
  MapPin as _MapPin,
  Medal,
  Megaphone as _Megaphone,
  Minus,
  Money,
  Monitor as _Monitor,
  Moon as _Moon,
  Mountains,
  MusicNote,
  NavigationArrow,
  Newspaper as _Newspaper,
  Package as _Package,
  Palette as _Palette,
  PaperPlaneTilt,
  Path,
  Pause as _Pause,
  Pencil as _Pencil,
  PencilSimple,
  PencilSimpleLine,
  Pentagon,
  Percent as _Percent,
  Phone as _Phone,
  Play as _Play,
  Plus,
  Prohibit,
  Pulse,
  PushPin,
  QrCode as _QrCode,
  Question,
  Receipt as _Receipt,
  Robot,
  Rocket as _Rocket,
  Scales,
  Scissors as _Scissors,
  SealCheck,
  ShareNetwork,
  Shield as _Shield,
  ShieldCheck as _ShieldCheck,
  ShieldSlash,
  ShieldWarning,
  ShoppingBag as _ShoppingBag,
  ShoppingCart as _ShoppingCart,
  SidebarSimple,
  SignIn,
  SignOut,
  Skull as _Skull,
  SlidersHorizontal as _SlidersHorizontal,
  Snowflake as _Snowflake,
  SortAscending,
  SortDescending,
  Sparkle,
  SpeakerHigh,
  Square,
  SquaresFour,
  Stack,
  Star as _Star,
  Storefront,
  Sun as _Sun,
  Sword,
  Tag as _Tag,
  Target as _Target,
  TextAlignLeft,
  TextT,
  ThumbsUp as _ThumbsUp,
  Timer as _Timer,
  Translate,
  Trash,
  Tree,
  TrendDown,
  TrendUp,
  Trophy as _Trophy,
  UploadSimple,
  User as _User,
  UserCheck as _UserCheck,
  UserGear,
  UserMinus as _UserMinus,
  UserPlus as _UserPlus,
  Users as _Users,
  UsersThree,
  VideoCamera,
  Wallet as _Wallet,
  Warning,
  WarningCircle,
  Wrench as _Wrench,
  X,
  XCircle,
  YoutubeLogo,
} from "@phosphor-icons/react"

export type { Icon as LucideIcon, IconProps as LucideProps } from "@phosphor-icons/react"

/* ------------------------------------------------------------------ */
/* Mapeamento nomes antigos (Lucide) -> ícones Phosphor               */
/* ------------------------------------------------------------------ */

export const Activity = Pulse
export const AlertCircle = WarningCircle
export const AlertTriangle = Warning
export const AlignLeft = TextAlignLeft
export const Anchor = _Anchor
export const Archive = _Archive
export { ArrowDown, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight }
export const ArrowDownIcon = ArrowDown
export const ArrowUpDown = ArrowsDownUp
export const AtSign = At
export const Award = Medal
export const BadgeCheck = SealCheck
export const Ban = Prohibit
export const Banknote = Money
export const BarChart3 = ChartBar
export { Bell }
export const BellOff = BellSlash
export const Bird = _Bird
export const Bolt = Lightning
export const Bomb = _Bomb
export const BookOpen = _BookOpen
export const Bot = Robot
export const Brain = _Brain
export const BrainCircuit = _Brain
export const Briefcase = _Briefcase
export const Bug = _Bug
export const Building2 = Buildings
export { Calendar }
export const CalendarDays = CalendarDots
export const Camera = _Camera
export const Cat = _Cat
export { Check, CheckCircle }
export const CheckCheck = Checks
export const CheckCircle2 = CheckCircle
export const CheckIcon = Check
export const ChevronDown = CaretDown
export const ChevronDownIcon = CaretDown
export const ChevronLeft = CaretLeft
export const ChevronLeftIcon = CaretLeft
export const ChevronRight = CaretRight
export const ChevronRightIcon = CaretRight
export const ChevronUp = CaretUp
export const ChevronUpIcon = CaretUp
export const ChevronsLeft = CaretDoubleLeft
export const ChevronsRight = CaretDoubleRight
export const ChevronsUpDown = CaretUpDown
export const Circle = _Circle
export const CircleIcon = _Circle
export const Clapperboard = FilmSlate
export const ClipboardCheck = ClipboardText
export const ClipboardList = ClipboardText
export const Clock = _Clock
export const CloudLightning = _CloudLightning
export const Coins = _Coins
export const Compass = _Compass
export const Cookie = _Cookie
export const Copy = _Copy
export const Copyright = _Copyright
export const CornerDownRight = ArrowBendDownRight
export const CreditCard = _CreditCard
export const Crosshair = _Crosshair
export const Crown = _Crown
export const Database = _Database
export const Dice5 = DiceFive
export const Dog = _Dog
export const DollarSign = CurrencyDollar
export const Download = DownloadSimple
export const Edit = PencilSimple
export const Edit2 = PencilSimple
export const Edit3 = PencilSimpleLine
export const ExternalLink = ArrowSquareOut
export const Eye = _Eye
export const EyeIcon = _Eye
export const EyeOff = EyeSlash
export const EyeOffIcon = EyeSlash
export const Facebook = FacebookLogo
export const FileCheck = _FileText
export const FileDown = FileArrowDown
export const FileSpreadsheet = FileXls
export const FileText = _FileText
export const FileVideo = _FileVideo
export const FileWarning = FileX
export const Film = FilmStrip
export const Filter = Funnel
export const Fish = _Fish
export const Flame = Fire
export const FolderOpen = _FolderOpen
export { FolderPlus }
export const Gamepad2 = GameController
export const Gauge = _Gauge
export const Gavel = _Gavel
export const Gem = Diamond
export const Ghost = _Ghost
export const Gift = _Gift
export const Globe = _Globe
export const GraduationCap = _GraduationCap
export const Grid3X3 = GridFour
export const GripVertical = DotsSixVertical
export const GripVerticalIcon = DotsSixVertical
export const HandCoins = _HandCoins
export const Handshake = _Handshake
export const HardDrive = HardDrives
export const Hash = _Hash
export const Headphones = _Headphones
export const Heart = _Heart
export const HelpCircle = Question
export const Home = House
export const IdCard = IdentificationCard
export const Image = _Image
export const ImageIcon = _Image
export const Info = _Info
export const Instagram = InstagramLogo
export const Joystick = _Joystick
export { Key }
export const KeyRound = Key
export const Languages = Translate
export const Layers = Stack
export const LayersIcon = Stack
export const LayoutGrid = SquaresFour
export const Leaf = _Leaf
export const Lightbulb = _Lightbulb
export const Link = _Link
export const Link2 = LinkSimple
export { List }
export const ListVideo = FilmStrip
export const Loader2 = CircleNotch
export const Loader2Icon = CircleNotch
export const LoaderCircleIcon = CircleNotch
export const Lock = _Lock
export const LogIn = SignIn
export const LogOut = SignOut
export const Mail = Envelope
export const MapPin = _MapPin
export const MapPinIcon = _MapPin
export const Maximize2 = ArrowsOut
export { Medal }
export const Megaphone = _Megaphone
export const Menu = List
export const MessageCircle = ChatCircle
export const MessageSquare = ChatText
export { Minus }
export const MinusIcon = Minus
export const Monitor = _Monitor
export const Moon = _Moon
export const MoreHorizontal = DotsThree
export const MoreHorizontalIcon = DotsThree
export const MoreVertical = DotsThreeVertical
export const Mountain = Mountains
export const MoveDown = ArrowDown
export const MoveUp = ArrowUp
export const Music = MusicNote
export const NavigationIcon = NavigationArrow
export const Newspaper = _Newspaper
export const Package = _Package
export const Palette = _Palette
export const PanelLeftIcon = SidebarSimple
export const PartyPopper = Confetti
export const Pause = _Pause
export const PenLineIcon = PencilSimpleLine
export const Pencil = _Pencil
export const PentagonIcon = Pentagon
export const Percent = _Percent
export const Phone = _Phone
export const PieChart = ChartPie
export const Pin = PushPin
export const Play = _Play
export { Plus }
export const PlusIcon = Plus
export const QrCode = _QrCode
export const Receipt = _Receipt
export const RefreshCcw = ArrowsCounterClockwise
export const RefreshCw = ArrowsClockwise
export const Reply = ArrowBendUpLeft
export const Rocket = _Rocket
export const RotateCcw = ArrowCounterClockwise
export const RotateCw = ArrowClockwise
export const Save = FloppyDisk
export const Scale = Scales
export const Scissors = _Scissors
export const Search = MagnifyingGlass
export const SearchIcon = MagnifyingGlass
export const Send = PaperPlaneTilt
export const Server = HardDrives
export const Settings = Gear
export const Share2 = ShareNetwork
export const Shield = _Shield
export const ShieldAlert = ShieldWarning
export const ShieldCheck = _ShieldCheck
export const ShieldOff = ShieldSlash
export const ShieldX = ShieldSlash
export const ShoppingBag = _ShoppingBag
export const ShoppingCart = _ShoppingCart
export const Skull = _Skull
export const SlidersHorizontal = _SlidersHorizontal
export const Smartphone = DeviceMobile
export const Snowflake = _Snowflake
export const SortAsc = SortAscending
export const SortDesc = SortDescending
export const Sparkles = Sparkle
export const SquareIcon = Square
export const Star = _Star
export const Store = Storefront
export const Sun = _Sun
export const Swords = Sword
export const Tablet = DeviceTablet
export const Tag = _Tag
export const Target = _Target
export const ThumbsUp = _ThumbsUp
export const Timer = _Timer
export const Trash2 = Trash
export const Trash2Icon = Trash
export const TreePine = Tree
export const TrendingDown = TrendDown
export const TrendingUp = TrendUp
export const Trophy = _Trophy
export const Type = TextT
export const Undo2 = ArrowUUpLeft
export const Undo2Icon = ArrowUUpLeft
export const Upload = UploadSimple
export const User = _User
export const UserCheck = _UserCheck
export const UserCog = UserGear
export const UserMinus = _UserMinus
export const UserPlus = _UserPlus
export const UserX = _UserMinus
export const Users = UsersThree
export const Users2 = _Users
export const Video = VideoCamera
export const Volume2 = SpeakerHigh
export const Wallet = _Wallet
export const Wand2 = MagicWand
export const WaypointsIcon = Path
export const Wrench = _Wrench
export { X, XCircle }
export const CircleCheckIcon = CheckCircle
export const InfoIcon = _Info
export const OctagonXIcon = XCircle
export const TriangleAlertIcon = Warning
export const XIcon = X
export const XOctagon = XCircle
export const Youtube = YoutubeLogo
export const Zap = Lightning
export { SignIn, SignOut }
