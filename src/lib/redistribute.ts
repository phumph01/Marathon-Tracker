export interface RedistributionInput {
  plannedWeek: number[];
  completedActuals: Array<number | null>;
  targetWeeklyTotal: number;
}

export interface RedistributionResult {
  adjustedWeek: number[];
  remainingMiles: number;
  exceededByMiles: number;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function redistributeWeekMiles({
  plannedWeek,
  completedActuals,
  targetWeeklyTotal
}: RedistributionInput): RedistributionResult {
  const adjustedWeek = plannedWeek.slice();
  const completedIndexes: number[] = [];
  const remainingIndexes: number[] = [];

  for (let i = 0; i < 7; i += 1) {
    if (completedActuals[i] != null) {
      completedIndexes.push(i);
      adjustedWeek[i] = Math.max(0, completedActuals[i] ?? 0);
    } else {
      remainingIndexes.push(i);
    }
  }

  const completedTotal = completedIndexes.reduce((sum, index) => sum + adjustedWeek[index], 0);
  let remainingMiles = roundToTenth(targetWeeklyTotal - completedTotal);

  if (remainingIndexes.length === 0) {
    return {
      adjustedWeek: adjustedWeek.map(roundToTenth),
      remainingMiles: 0,
      exceededByMiles: remainingMiles < 0 ? Math.abs(remainingMiles) : 0
    };
  }

  if (remainingMiles <= 0) {
    remainingIndexes.forEach((index) => {
      adjustedWeek[index] = 0;
    });

    return {
      adjustedWeek: adjustedWeek.map(roundToTenth),
      remainingMiles: 0,
      exceededByMiles: Math.abs(Math.min(remainingMiles, 0))
    };
  }

  const remainingPlannedTotal = remainingIndexes.reduce((sum, index) => sum + plannedWeek[index], 0);
  const weighted: number[] = remainingIndexes.map((index) => {
    if (remainingPlannedTotal === 0) {
      return remainingMiles / remainingIndexes.length;
    }
    return (plannedWeek[index] / remainingPlannedTotal) * remainingMiles;
  });

  remainingIndexes.forEach((index, arrayIdx) => {
    adjustedWeek[index] = roundToTenth(weighted[arrayIdx]);
  });

  const sumAfterRounding = adjustedWeek.reduce((sum, miles) => sum + miles, 0);
  let residual = roundToTenth(targetWeeklyTotal - sumAfterRounding);

  if (residual !== 0) {
    let recipientIndex = remainingIndexes[0];
    let bestRatio = -1;
    remainingIndexes.forEach((index) => {
      const ratio = remainingPlannedTotal === 0 ? 1 : plannedWeek[index] / remainingPlannedTotal;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        recipientIndex = index;
      }
    });

    adjustedWeek[recipientIndex] = Math.max(0, roundToTenth(adjustedWeek[recipientIndex] + residual));
    const finalTotal = adjustedWeek.reduce((sum, miles) => sum + miles, 0);
    residual = roundToTenth(targetWeeklyTotal - finalTotal);
    if (residual !== 0) {
      adjustedWeek[recipientIndex] = roundToTenth(adjustedWeek[recipientIndex] + residual);
    }
  }

  return {
    adjustedWeek: adjustedWeek.map(roundToTenth),
    remainingMiles,
    exceededByMiles: 0
  };
}

