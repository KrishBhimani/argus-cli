export const cumulative = (v: number[]): number[] => {
  let a = 0;
  return v.map((x) => (a += x));
};
