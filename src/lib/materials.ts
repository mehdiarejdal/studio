export interface Material {
  name: string;
  type: string; // Comma-separated types like "EF, ECS" or "EV"
  pn: number[]; // Available pressure ratings
  temp: number; // Max temperature
  corrosion: number; // Corrosion resistance score
  vie: number; // Lifespan score
  pose: number; // Ease of installation score
  acoustique: number; // Acoustic performance score
  feu: number; // Fire resistance score
  environnement: number; // Environmental impact score
  surpression: number; // Overpressure resistance score
}

export const materialsDb: Material[] = [
  { name: "Cuivre", type: "EF, ECS", pn: [10, 16, 20, 25], temp: 90, corrosion: 10, vie: 70, pose: 3, acoustique: 7, feu: 7, environnement: 3, surpression: 10 },
  { name: "PER", type: "EF, ECS", pn: [6, 10, 16], temp: 90, corrosion: 7, vie: 50, pose: 9, acoustique: 7, feu: 5, environnement: 5, surpression: 3 },
  { name: "PP-R", type: "EF, ECS", pn: [10, 16, 20, 25], temp: 95, corrosion: 9, vie: 50, pose: 6, acoustique: 7, feu: 7, environnement: 5, surpression: 7 },
  { name: "Fonte", type: "EV", pn: [10, 16, 25, 40], temp: 80, corrosion: 9, vie: 100, pose: 3, acoustique: 10, feu: 9, environnement: 3, surpression: 10 },
  { name: "CPVC", type: "EF, ECS", pn: [10, 16, 20, 25], temp: 95, corrosion: 10, vie: 60, pose: 9, acoustique: 7, feu: 9, environnement: 5, surpression: 10 },
  { name: "PEHD", type: "EF, EV", pn: [6, 10, 16, 20, 25], temp: 80, corrosion: 10, vie: 100, pose: 8, acoustique: 7, feu: 5, environnement: 5, surpression: 9 },
  { name: "PVC", type: "EV", pn: [6, 10, 16, 25], temp: 60, corrosion: 8, vie: 50, pose: 9, acoustique: 6, feu: 5, environnement: 5, surpression: 6 },
];

export type CriterionKey = keyof Omit<Material, 'name' | 'type' | 'pn'> | 'cout';

export interface Criterion {
  key: CriterionKey;
  label: string;
  isBenefit: boolean; // True if higher is better, false if lower is better (like cost)
}

export const allCriteria: Criterion[] = [
  { key: "temp", label: "Température maximale (°C)", isBenefit: true },
  { key: "corrosion", label: "Résistance à la corrosion", isBenefit: true },
  { key: "vie", label: "Durée de vie (années)", isBenefit: true },
  { key: "pose", label: "Facilité de pose", isBenefit: true },
  { key: "acoustique", label: "Performance acoustique", isBenefit: true },
  { key: "feu", label: "Résistance au feu", isBenefit: true },
  { key: "environnement", label: "Impact environnemental", isBenefit: true },
  { key: "surpression", label: "Résistance à la surpression", isBenefit: true },
  { key: "cout", label: "Coût (MAD/m)", isBenefit: false },
];

export const pressureNominalValues = [6, 10, 16, 20, 25, 40];
