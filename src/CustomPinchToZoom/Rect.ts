import { isEqual as isEqualPoint, Point } from "./Point";
import { isEqual as isEqualSize, Size } from "./Size";

interface IRect {
  origin: Point;
  size: Size;
}

function isEqual(m: Rect, n: Rect): boolean {
  return isEqualPoint(m.origin, n.origin) && isEqualSize(m.size, n.size);
}

export interface Rect extends IRect{};
export { isEqual };
