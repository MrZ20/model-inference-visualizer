export interface MatrixCell { row: number; column: number; value: number; }
export const projectMatrix = (matrix: number[][]): MatrixCell[] => matrix.flatMap((row, r) => row.map((value, c) => ({ row: r, column: c, value })));
export function normalize(values: number[]): number[] {
  if (!values.length) return [];
  const minimum = Math.min(...values), maximum = Math.max(...values), span = maximum - minimum;
  return span === 0 ? values.map(() => 0.5) : values.map((value) => (value - minimum) / span);
}
export const topEntries = (values: number[], count: number) => values.map((value, index) => ({ index, value })).sort((a, b) => b.value - a.value).slice(0, count);
export const stageProgress = (progress: number, index: number, count: number) => Math.min(1, Math.max(0, (progress - index / count) * count));
