export function metersToReadable(m: number | null): string {
  if (m == null) return '';
  const feet = m * 3.28084;
  if (feet < 1000) return `${Math.round(feet)} ft`;
  const miles = m / 1609.344;
  return `${miles.toFixed(1)} mi`;
}

export function milesToMeters(mi: number): number {
  return Math.round(mi * 1609.344);
}
