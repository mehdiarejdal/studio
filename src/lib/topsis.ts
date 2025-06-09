
import type { Material, Criterion, CriterionKey } from './materials';

interface TopsisInput {
  selectedMaterialsData: Material[];
  selectedCriteriaKeys: CriterionKey[];
  allCriteriaDefinition: Criterion[];
  costs: Record<string, number>; // Material name -> cost
  weights: Record<CriterionKey, number>; // Criterion key -> weight
}

export interface TopsisFullResults extends TopsisResult {
  initialMatrix: number[][];
  normalizedMatrix: number[][];
  weightedMatrix: number[][];
  idealSolution: number[];
  antiIdealSolution: number[];
  distanceToIdeal: number[];
  distanceToAntiIdeal: number[];
}


export interface TopsisResult {
  name: string;
  score: number; // Can be NaN
  originalData: Material;
  calculatedValues: Record<CriterionKey, number>;
}

export function runTopsisCalculation({
  selectedMaterialsData,
  selectedCriteriaKeys,
  allCriteriaDefinition,
  costs,
  weights,
}: TopsisInput): TopsisFullResults[] {
  if (selectedMaterialsData.length === 0 || selectedCriteriaKeys.length === 0) {
    return [];
  }

  // 1. Create the decision matrix
  const initialMatrix: number[][] = selectedMaterialsData.map(material =>
    selectedCriteriaKeys.map(criterionKey => {
      if (criterionKey === 'cout') {
        return costs[material.name] || 0;
      }
      return material[criterionKey as keyof Omit<Material, 'name' | 'type' | 'pn'>] as number;
    })
  );

  // 2. Normalize the decision matrix
  const numRows = initialMatrix.length;
  const numCols = initialMatrix[0].length;
  const normalizedMatrix: number[][] = Array(numRows)
    .fill(0)
    .map(() => Array(numCols).fill(0));

  for (let j = 0; j < numCols; j++) {
    let sumOfSquares = 0;
    for (let i = 0; i < numRows; i++) {
      sumOfSquares += initialMatrix[i][j] ** 2;
    }
    const norm = Math.sqrt(sumOfSquares);
    if (norm === 0) { // Avoid division by zero if all values in a column are 0
      for (let i = 0; i < numRows; i++) {
        normalizedMatrix[i][j] = 0;
      }
    } else {
      for (let i = 0; i < numRows; i++) {
        normalizedMatrix[i][j] = initialMatrix[i][j] / norm;
      }
    }
  }
  
  // 3. Create the weighted normalized decision matrix
  const weightedMatrix: number[][] = Array(numRows)
    .fill(0)
    .map(() => Array(numCols).fill(0));

  for (let i = 0; i < numRows; i++) {
    for (let j = 0; j < numCols; j++) {
      const criterionKey = selectedCriteriaKeys[j];
      weightedMatrix[i][j] = normalizedMatrix[i][j] * (weights[criterionKey] || 0);
    }
  }

  // 4. Determine the ideal and anti-ideal solutions
  const idealSolution: number[] = Array(numCols).fill(0);
  const antiIdealSolution: number[] = Array(numCols).fill(0);
  const criteriaMap = new Map(allCriteriaDefinition.map(c => [c.key, c]));


  for (let j = 0; j < numCols; j++) {
    const criterionKey = selectedCriteriaKeys[j];
    const criterion = criteriaMap.get(criterionKey);
    const columnValues = weightedMatrix.map(row => row[j]);

    if (criterion?.isBenefit) {
      idealSolution[j] = Math.max(...columnValues);
      antiIdealSolution[j] = Math.min(...columnValues);
    } else {
      idealSolution[j] = Math.min(...columnValues);
      antiIdealSolution[j] = Math.max(...columnValues);
    }
  }
  
  // 5. Calculate the separation measures
  const distanceToIdeal: number[] = Array(numRows).fill(0);
  const distanceToAntiIdeal: number[] = Array(numRows).fill(0);

  for (let i = 0; i < numRows; i++) {
    let sumSqIdeal = 0;
    let sumSqAntiIdeal = 0;
    for (let j = 0; j < numCols; j++) {
      sumSqIdeal += (weightedMatrix[i][j] - idealSolution[j]) ** 2;
      sumSqAntiIdeal += (weightedMatrix[i][j] - antiIdealSolution[j]) ** 2;
    }
    distanceToIdeal[i] = Math.sqrt(sumSqIdeal);
    distanceToAntiIdeal[i] = Math.sqrt(sumSqAntiIdeal);
  }

  // 6. Calculate the relative closeness to the ideal solution
  const scores: number[] = Array(numRows).fill(0);
  for (let i = 0; i < numRows; i++) {
    const denominator = distanceToIdeal[i] + distanceToAntiIdeal[i];
    scores[i] = denominator === 0 ? NaN : distanceToAntiIdeal[i] / denominator; // Return NaN if denominator is 0
  }

  // 7. Rank the preferences
  const results: TopsisFullResults[] = selectedMaterialsData.map((material, index) => {
    const calculatedValues: Record<CriterionKey, number> = {};
    selectedCriteriaKeys.forEach((key, j_idx) => {
      calculatedValues[key] = initialMatrix[index][j_idx];
    });
    return {
      name: material.name,
      score: scores[index],
      originalData: material,
      calculatedValues,
      initialMatrix: initialMatrix.map(row => [...row]), 
      normalizedMatrix: normalizedMatrix.map(row => [...row]), 
      weightedMatrix: weightedMatrix.map(row => [...row]), 
      idealSolution: [...idealSolution], 
      antiIdealSolution: [...antiIdealSolution], 
      distanceToIdeal: [...distanceToIdeal], 
      distanceToAntiIdeal: [...distanceToAntiIdeal], 
    };
  });
  
  results.sort((a, b) => {
    const scoreA = isNaN(a.score) ? -Infinity : a.score; // Treat NaN as lowest score for sorting
    const scoreB = isNaN(b.score) ? -Infinity : b.score;
    return scoreB - scoreA;
  });

  return results;
}
