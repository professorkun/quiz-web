/** A/B/C/D 只在渲染时由下标生成，绝不写回作答、答案或会话 */
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function optionLetter(index: number): string {
  return LETTERS[index] ?? `#${index + 1}`;
}
