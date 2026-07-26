import {
  ArrowLeftRight,
  Banknote,
  BookOpen,
  ChartPie,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  HandCoins,
  Landmark,
  LayoutGrid,
  ListChecks,
  Lock,
  Menu,
  Pencil,
  PiggyBank,
  Play,
  Plus,
  RefreshCw,
  Receipt,
  Search,
  SearchX,
  SlidersHorizontal,
  Sparkles,
  Star,
  TrendingUp,
  TriangleAlert,
  Trash2,
  Upload,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Satu-satunya sumber ikon. Emoji dipakai lagi HANYA untuk konten milik user
 * (emoji wishlist) dan ilustrasi tutorial — di sana emoji memang isinya, bukan
 * penanda antarmuka.
 */
export const Icons = {
  income: Wallet,
  expense: Receipt,
  cash: Banknote,
  planned: ListChecks,
  piutang: HandCoins,
  account: Landmark,
  budget: ChartPie,
  wishlist: Sparkles,
  summary: TrendingUp,
  data: Database,
  guide: BookOpen,

  add: Plus,
  edit: Pencil,
  delete: Trash2,
  check: Check,
  close: X,
  menu: Menu,
  more: LayoutGrid,
  prev: ChevronLeft,
  next: ChevronRight,
  help: CircleHelp,
  play: Play,
  settings: SlidersHorizontal,
  search: Search,
  'search-empty': SearchX,
  show: Eye,
  hide: EyeOff,

  download: Download,
  upload: Upload,
  copy: Copy,
  refresh: RefreshCw,
  file: FolderOpen,

  warn: TriangleAlert,
  near: Zap,
  lock: Lock,
  swap: ArrowLeftRight,
  saving: PiggyBank,
  star: Star,
  clock: Clock,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof Icons;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  color?: string;
  /** Ikon dekoratif di samping teks tidak perlu dibacakan screen reader. */
  label?: string;
}

export function Icon({ name, size = 16, className, color, label }: IconProps): React.ReactElement {
  const Cmp = Icons[name];
  return (
    <Cmp
      size={size}
      strokeWidth={1.75}
      className={'icon' + (className ? ' ' + className : '')}
      color={color}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    />
  );
}
