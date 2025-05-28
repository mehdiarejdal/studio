import {
  Thermometer,
  ShieldAlert,
  Activity,
  Construction,
  Volume2,
  Flame,
  Leaf,
  Gauge,
  DollarSign,
  Layers,
  Droplets,
  HelpCircle,
  type LucideProps,
} from 'lucide-react';
import type { CriterionKey } from '@/lib/materials';

export const CriteriaIcons: Record<CriterionKey, React.FC<LucideProps>> = {
  temp: Thermometer,
  corrosion: ShieldAlert,
  vie: Activity,
  pose: Construction,
  acoustique: Volume2,
  feu: Flame,
  environnement: Leaf,
  surpression: Gauge,
  cout: DollarSign,
};

export const NetworkTypeIcons = {
  Alimentation: Droplets,
  Evacuation: Layers,
  Default: HelpCircle,
};

export { Thermometer, ShieldAlert, Activity, Construction, Volume2, Flame, Leaf, Gauge, DollarSign, Layers, Droplets, HelpCircle };
