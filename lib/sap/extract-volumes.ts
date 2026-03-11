// /lib/sap/extract-volumes.ts
// Volume extraction from SAP step data

import type { SapStep } from '@/types/sap';

/** Sum volumes by unit type across steps, using volumeQuantity with ceBillQuantity fallback */
export function sumVolumesByUnit(steps: SapStep[], unit: string): number {
  return steps.reduce((total, step) => {
    const match = (step.volume ?? []).find(
      v => v.volumeUnit.toLowerCase() === unit.toLowerCase()
    );
    if (!match) return total;
    return total + (match.volumeQuantity || match.ceBillQuantity || 0);
  }, 0);
}

/** Count terms from steps */
export function countTerms(steps: SapStep[]): number {
  return steps.reduce((total, step) => {
    const match = (step.volume ?? []).find(v => v.volumeUnit === 'Terms');
    return total + (match ? 1 : 0);
  }, 0);
}
