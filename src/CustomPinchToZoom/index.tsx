/**
 * PinchToZoom react componenets
 */

import * as PropTypes from "prop-types";
import * as React from "react";
import * as Point from "./Point";
import * as Size from "./Size";
import BoxCanvas from "../BoxCanvas";

const truncRound = (num: number): number => Math.trunc(num * 10000) / 10000;

enum GUESTURE_TYPE {
  UNSET = "GUESTURE_TYPE_UNSET",
  PAN = "GUESTURE_TYPE_PAN",
  PINCH = "GUESTURE_TYPE_PINCH",
  DRAW = "GUESTURE_TYPE_DRAW",
  RESIZE = "GUESTURE_TYPE_RESIZE"
}

type CanvasRect = {
  pos : Point.Point,
  width: number,
  height: number
}

type CropOffset = {
  y : number,
  x : number
}

type CropRect = {
  startPos: Point.Point,
  startWidth: number,
  startHeight: number,
  absPos: Point.Point,
  absWidth: number,
  absHeight: number,
  xDif: number,
  yDif: number,
  midX: number,
  midY: number,
  xInversed: boolean,
  yInversed: boolean,
  xCrossOver: boolean,
  yCrossover: boolean,
  startXCrossOver: boolean,
  startYCrossOver: boolean,
  ord: string,
  isResize: boolean,
  offset: Point.Point,
}

type evData = {
    startPos: Point.Point,
    prevPos: Point.Point,
    curPos: Point.Point,
    curWidth: number,
    curHeight: number,
    ord: string,
    offset: Point.Point,
    isResize: boolean,
    xCrossOver: boolean,
    yCrossOver: boolean,
    xInversed: boolean,
    yInversed: boolean,
    xDif: number,
    yDif: number,
    xMid: number,
    yMid: number,
}

interface PinchToZoomProps {
  src: string;
  debug: boolean;
  moveMode: boolean;
  canvRef: HTMLCanvasElement;
  disableWork: boolean;
  className: string;
  minZoomScale: number;
  maxZoomScale: number;
  boundSize: Size.Size;
  contentSize: Size.Size;
}

interface PinchToZoomState {
  lastSingleTouchPoint: Point.Point;
  isRect: boolean;
  drawIsActive: boolean;
}

function inverseOrd(ord: string) {
  let inversedOrd;

  if (ord === "n") inversedOrd = "s";
  else if (ord === "ne") inversedOrd = "sw";
  else if (ord === "e") inversedOrd = "w";
  else if (ord === "se") inversedOrd = "nw";
  else if (ord === "s") inversedOrd = "n";
  else if (ord === "sw") inversedOrd = "ne";
  else if (ord === "w") inversedOrd = "e";
  else if (ord === "nw") inversedOrd = "se";

  return inversedOrd;
}

function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}


class CustomPinchToZoom extends React.Component<
  PinchToZoomProps,
  PinchToZoomState
> {
  public static defaultProps: {};
  public static propTypes: {};
  public static getTouchesCoordinate(
    syntheticEvent: React.SyntheticEvent
  ): Point.Point[] {
    /**
     * adjust browser touch point coordinate to bounds
     */
    const {
      currentTarget: { parentNode },
      nativeEvent
    } = syntheticEvent;
    // DOM node
    if (
      !(parentNode instanceof HTMLElement) ||
      !(nativeEvent instanceof TouchEvent)
    ) {
      return [];
    }
    const containerRect = parentNode.getBoundingClientRect();
    const rect = {
      origin: { x: containerRect.left, y: containerRect.top },
      size: {
        width: containerRect.width,
        height: containerRect.height
      }
    };
    // DOM touch list
    const { touches: touchList } = nativeEvent;
    const coordinates = []; // [{x1, y1}, {x2, y2}...]
    for (let i = 0; i < touchList.length; i += 1) {
      const touch = touchList.item(i);
      if (touch) {
        const touchPoint = {
          x: touch.clientX,
          y: touch.clientY
        };
        const p = Point.normalizePointInRect(touchPoint, rect);
        coordinates.push(p);
      }
    }
    return coordinates;
  }

  public transform: {
    zoomFactor: number;
    translate: Point.Point;
  };

  public currentGesture: GUESTURE_TYPE;
  public drawStartZoomFactor: number;
  public drawStartPoint: Point.Point;
  public drawStartTranslate: Point.Point;

  public resizeStartZoomFactor: number;
  public resizeStartPoint: Point.Point;
  public resizeStartTranslate: Point.Point;
  public resizeStartArea: string;

  public pinchStartZoomFactor: number;
  public pinchStartTouchMidpoint: Point.Point;
  public pinchStartTranslate: Point.Point;
  public pinchStartTouchPointDist: number;

  public panStartPoint: Point.Point;
  public panStartTranslate: Point.Point;

  public zoomAreaContainer?: HTMLDivElement;
  public zoomArea?: HTMLDivElement;
  public canv =  React.createRef<HTMLCanvasElement>();
  private lastTime: number;
//   private evData: CropRect;
  private drawStarted: boolean;
  private mouseDownOnCrop: boolean;
  public drawCanvas: Function;
  private canvWidth: number;
  private canvHeight: number;
  public evData: evData;
  constructor(props: PinchToZoomProps) {
    super(props);
    // instance variable: transform data
    this.transform = {
      zoomFactor: 1.0,
      translate: Point.newOriginPoint()
    };
    // initial value
    this.canvWidth = 0;
    this.canvHeight = 0;

    // instance variable: guesture
    this.currentGesture = GUESTURE_TYPE.UNSET;
    // instance variable: pinch
    this.pinchStartZoomFactor = 1.0;
    this.pinchStartTouchMidpoint = Point.newOriginPoint();
    this.pinchStartTranslate = Point.newOriginPoint();
    this.pinchStartTouchPointDist = 0;

    // instance variable: draw
    this.drawStartZoomFactor = 1.0;
    this.drawStartPoint = Point.newOriginPoint();
    this.drawStartTranslate = Point.newOriginPoint();

    // instance variable: draw
    this.resizeStartZoomFactor = 1.0;
    this.resizeStartPoint = Point.newOriginPoint();
    this.resizeStartTranslate = Point.newOriginPoint();
    this.resizeStartArea = "";

    // instance variable: pan
    this.panStartPoint = Point.newOriginPoint();
    this.panStartTranslate = Point.newOriginPoint();
    this.drawStarted = false;
    this.mouseDownOnCrop = false;
    this.evData = {
      startPos: Point.newOriginPoint(),
      prevPos: Point.newOriginPoint(),
      curPos: Point.newOriginPoint(),
      curHeight: 0,
      curWidth: 0,
      xDif: 0,
      yDif: 0,
      xMid: 0,
      yMid: 0,
      xInversed: false,
      yInversed: false,
      xCrossOver: false,
      yCrossOver: false,
      ord:"",
      isResize: false,
      offset: {
        y:0,
        x:0
      }
    }
    // record last touch point
    this.state = {
      lastSingleTouchPoint: Point.newOriginPoint(),
      isRect : false,
      drawIsActive: false,
    };

    // CUSTOM : for doubletap variable
    this.lastTime = -100000;
    this.drawCanvas = () => {};
  }
  public componentDidMount() {
    this.canvWidth = this.canv.current!.width;
    this.canvHeight = this.canv.current!.height;
  }

  public componentDidUpdate(prevProps: PinchToZoomProps) {
    if (
      prevProps.minZoomScale !== this.props.minZoomScale ||
      prevProps.boundSize.height !== this.props.boundSize.height
    ) {
      this.zoomContentArea(this.props.minZoomScale);
      this.guardZoomAreaTranslate();
    }
  }
  /*
    Pinch event handlers
  */
  public getData() {
      const { offset, curWidth, curHeight } = this.evData;
      return {
          offset,
          width: curWidth,
          height: curHeight,
          canvasWidth: this.canvWidth,
          canvasHeight: this.canvHeight
      }
  }

  public reset() {
    this.setTransform({
        zoomFactor: 1,
        translate: Point.newOriginPoint()
    })
    this.evData = {
        startPos: Point.newOriginPoint(),
        prevPos: Point.newOriginPoint(),
        curPos: Point.newOriginPoint(),
        curHeight: 0,
        curWidth: 0,
        xDif: 0,
        yDif: 0,
        xMid: 0,
        yMid: 0,
        xInversed: false,
        yInversed: false,
        xCrossOver: false,
        yCrossOver: false,
        ord:"",
        isResize: false,
        offset: {
          y:0,
          x:0
        }
    }
    this.setState({
        lastSingleTouchPoint: Point.newOriginPoint(),
        isRect: false,
        drawIsActive: false
    })
  }

  public onPinchStart(syntheticEvent: React.SyntheticEvent) {
    const [p1, p2] = CustomPinchToZoom.getTouchesCoordinate(syntheticEvent);

    // on pinch start remember the mid point of 2 touch points
    this.pinchStartTouchMidpoint = Point.midpoint(p1, p2);

    // on pinch start remember the distance of 2 touch points
    this.pinchStartTouchPointDist = Point.distance(p1, p2);

    /*
      on pinch start, remember the `origianl zoom factor`
      & `origianl plan translate` before pinching
    */
    const { currentZoomFactor, currentTranslate } = this.getTransform();
    this.pinchStartZoomFactor = currentZoomFactor;
    this.pinchStartTranslate = currentTranslate;
  }

  public onPinchMove(syntheticEvent: React.SyntheticEvent) {
    // get lastest touch point coordinate
    const [p1, p2] = CustomPinchToZoom.getTouchesCoordinate(syntheticEvent);

    // const pinchCurrentTouchMidpoint = SeatingPlan.calculateMidpoint({ x1, y1 }, { x2, y2 });

    const pinchCurrentTouchPointDist = Point.distance(p1, p2);

    // delta > 0: enlarge(zoon in), delta < 0: diminish(zoom out)
    const deltaTouchPointDist =
      pinchCurrentTouchPointDist - this.pinchStartTouchPointDist;

    // update zoom factor
    const newZoomFactor =
      this.pinchStartZoomFactor + deltaTouchPointDist * 0.01;
    this.zoomContentArea(newZoomFactor);
  }

  public onPinchEnd() {
    this.guardZoomAreaScale();
    this.guardZoomAreaTranslate();
  }

  /**
   * true : BoxMode, false : MoveMode
   * @param syntheticEvent
   * @returns boolean
   */
  private isBoxOrMove(syntheticEvent: React.SyntheticEvent) {
    let currentTime = syntheticEvent.timeStamp;

    // milliseconds
    let DOUBLE_TAP_VALID_TIME = 500;

    if (currentTime - this.lastTime < DOUBLE_TAP_VALID_TIME) {
      this.lastTime = currentTime;
      return false;
    }
    this.lastTime = currentTime;
    return true;
  }
  /*
    Pan event handlers
  */

  public onPanStart(syntheticEvent: React.SyntheticEvent) {
    const [p1] = CustomPinchToZoom.getTouchesCoordinate(syntheticEvent)
    const { currentTranslate } = this.getTransform()

    this.panStartPoint = p1
    this.panStartTranslate = currentTranslate
  }

  public onPanMove(syntheticEvent: React.SyntheticEvent) {
    const [dragPoint] = CustomPinchToZoom.getTouchesCoordinate(syntheticEvent)
    const { currentZoomFactor } = this.getTransform()
    const origin = this.panStartPoint
    const prevTranslate = this.panStartTranslate

    const dragOffset = Point.offset(dragPoint, origin)
    const adjustedZoomOffset = Point.scale(dragOffset, 1 / currentZoomFactor)
    const nextTranslate = Point.sum(adjustedZoomOffset, prevTranslate)
    this.panContentArea(nextTranslate)
  }

  public onPanEnd() {
    this.guardZoomAreaTranslate()
  }

  public getAbsoluteTransform(pos: Point.Point, width:number, height:number) : CanvasRect {
    const { currentZoomFactor, currentTranslate } = this.getTransform();

    let absPos:Point.Point, absX, absY, absWidth, absHeight;
    if (!currentZoomFactor) return {pos, width, height};

    absX = pos.x / currentZoomFactor - currentTranslate.x;
    absY = pos.y / currentZoomFactor - currentTranslate.y;
    absWidth = width / currentZoomFactor;
    absHeight = height / currentZoomFactor;
    console.log(absX,absY,absWidth,absHeight);
    absX = clamp(absX, 0, this.canvWidth);
    absY = clamp(absY, 0, this.canvHeight);
    absWidth = clamp(absWidth, 0, this.canvWidth);
    absHeight = clamp(absHeight, 0, this.canvHeight);
    return {
      pos : { x: absX, y: absY},
      width : absWidth,
      height: absHeight
    }
  }

  public getAbsolutePos(pos: Point.Point): Point.Point {
    const { currentZoomFactor, currentTranslate } = this.getTransform();
    if (!currentZoomFactor) return pos;

    let absX: number, absY: number;
    absX = pos.x / currentZoomFactor - currentTranslate.x;
    absY = pos.y / currentZoomFactor - currentTranslate.y;
    absX = clamp(absX, 0, this.canvWidth);
    absY = clamp(absY, 0, this.canvHeight);
    return {
      x: absX,
      y: absY
    }
  }

  public getRelativeTransform(pos: Point.Point, width:number, height:number) : CanvasRect {
    const { currentZoomFactor, currentTranslate } = this.getTransform();
    let relX, relY, relWidth, relHeight;
    if (!currentZoomFactor) return {pos, width, height};
    
    relX = currentZoomFactor * (pos.x + currentTranslate.x);
    relY = currentZoomFactor * (pos.y + currentTranslate.y);
    relWidth = currentZoomFactor * width;
    relHeight = currentZoomFactor * height;

    return {
      pos: {x:relX, y:relY},
      width: relWidth,
      height: relHeight
    };
  }

  public getRelativePos(pos: Point.Point): Point.Point {
    const { currentZoomFactor, currentTranslate } = this.getTransform();
    if (!currentZoomFactor) return pos;
    let relX, relY;
    relX = currentZoomFactor * (pos.x + currentTranslate.x);
    relY = currentZoomFactor * (pos.y + currentTranslate.y);
    relX = clamp(relX, 0, this.canvWidth);
    relY = clamp(relY, 0, this.canvHeight);
    return {
      x: relX,
      y: relY
    }
  }

  public isPanAvailable() {
    const { evData } = this;
    const { offset, curWidth, curHeight } = evData;
    const { currentZoomFactor, currentTranslate } = this.getTransform();
    let dir: string="";
    let relOffset: Point.Point = this.getRelativePos(offset),
        relEdge: Point.Point = this.getRelativePos(
            Point.sum(offset, {
                x: curWidth,
                y: curHeight
            }));
    if (relOffset.x < 3) {
        dir += "l";
        this.setTransform({
            zoomFactor: currentZoomFactor - 0.1,
            translate: {
                x: currentTranslate.x + 5,
                y: currentTranslate.y
            }
        });
    }
    if (relEdge.x > this.canvWidth - 3) {
        dir += "r";
        this.setTransform({
            zoomFactor: currentZoomFactor - 0.1,
            translate: {
                x: currentTranslate.x - 5,
                y: currentTranslate.y
            }
        });
    }
    if (relOffset.y < 3) {
        dir += "u";
        this.setTransform({
            zoomFactor: currentZoomFactor - 0.1,
            translate: {
                x: currentTranslate.x,
                y: currentTranslate.y + 5
            }
        });
    }
    if (relEdge.y > this.canvHeight - 3) {
        dir += "d";
        this.setTransform({
            zoomFactor: currentZoomFactor - 0.1,
            translate: {
                x: currentTranslate.x,
                y: currentTranslate.y - 5
            }
        });
    }
    // this.panContentArea()
    return dir;
  }

  public onDrawBoxStart(syntheticEvent: React.SyntheticEvent) {
    const { moveMode } = this.props;
    const { isRect } = this.state;
    if (moveMode || isRect) {
      return;
    }
    const [p1] = CustomPinchToZoom.getTouchesCoordinate(syntheticEvent);
    const { currentTranslate, currentZoomFactor } = this.getTransform();

    this.drawStartPoint = p1;
    this.drawStartTranslate = currentTranslate;
    this.drawStartZoomFactor = currentZoomFactor;
    this.mouseDownOnCrop = true;
    this.setState({
        drawIsActive: true
      });
    let startPos: Point.Point;
    startPos = this.getAbsolutePos(p1);
    this.evData = {
        ...this.evData,
        startPos,
        curPos: startPos,
        offset: {
            x: startPos.x,
            y: startPos.y
        }
    }
  }

  public onDrawBoxMove(syntheticEvent: React.SyntheticEvent) {
    const { moveMode } = this.props;
    const { isRect } = this.state;
    if (moveMode || !this.mouseDownOnCrop || isRect) {
      return;
    }
    const [dragPoint] = CustomPinchToZoom.getTouchesCoordinate(syntheticEvent);
    const absDragPoint = this.getAbsolutePos(dragPoint);
    let dir: string;
    dir = this.isPanAvailable();
    console.log("draw Pan direction", dir);
    this.updateEvData(absDragPoint);
    this.setState({
        lastSingleTouchPoint: dragPoint
    })
    // panContentArea(nextTranslate)
  }

//   private boundWithinCanvas(p: Point.Point) : boolean {
//       let origin: Point.Point = {
//           x: 0,
//           y: 0
//       }, endPoint: Point.Point = {
//           x: this.canvWidth,
//           y: this.canvHeight
//       }
//       console.log("canvSize: ", endPoint);
//     //   return (Point.boundWithin(origin, p, endPoint));
//   }

  private updateEvData(absDragPoint: Point.Point) {
      const { evData } = this;
      const { startPos } = evData;
      
      let xInversed, yInversed, width, height,
        midPoint:Point.Point, ord: string = "", diff: Point.Point;
      diff = Point.offset(absDragPoint, startPos);
      xInversed = (diff.x < 0);
      yInversed = (diff.y < 0);
      ord += (yInversed) ? "u" : "d";
      ord += (xInversed) ? "l" : "r";
      height = Math.abs(diff.y);
      width = Math.abs(diff.x);
      let offset: Point.Point = this.evData.offset;
      offset.y = ord.includes("d") ? startPos.y : absDragPoint.y;
      offset.x = ord.includes("r") ? startPos.x : absDragPoint.x;
      midPoint = Point.sum(startPos, absDragPoint);
      midPoint = Point.scale(midPoint, 0.5);

      this.evData = {
          ...this.evData,
          curPos: absDragPoint,
          xInversed,
          yInversed,
          ord,
          offset,
          xMid: midPoint.x,
          yMid: midPoint.y,
          xDif: diff.x,
          yDif: diff.y,
          curWidth: width,
          curHeight: height
      }
  }

  public onDrawBoxEnd() {
    const { isRect } = this.state;
    const { curWidth, curHeight } = this.evData;
    if ( isRect ) {
      return;
    }
    this.drawStarted = false;
    this.mouseDownOnCrop = false;
    this.evData = {
        ...this.evData,
        isResize: true,
        startPos : Point.newOriginPoint(),
        prevPos : Point.newOriginPoint(),
        curPos : Point.newOriginPoint(),
        ord : "",
        xCrossOver : false,
        yCrossOver : false,
        xInversed : false,
        yInversed : false,
        xDif : 0,
        yDif : 0
    };
    let midPoint: Point.Point = {
        x: this.evData.xMid,
        y: this.evData.yMid
    }
    let scale: number = Math.max( this.canvWidth, this.canvHeight) /
                (Math.max( curWidth, curHeight ) * 3);
    scale = (scale < 1) ? 1 : scale;
    this.customZoomToPosition(
        this.getRelativePos(midPoint), scale);
    this.setState({
        drawIsActive : false,
        isRect: true,
      });
  }
  
  public onResizeBoxStart(syntheticEvent: React.SyntheticEvent) {
    const { moveMode } = this.props;
    const { isRect } = this.state;
    if (moveMode || !isRect) {
      return;
    }
    const [p1] = CustomPinchToZoom.getTouchesCoordinate(syntheticEvent);
    console.log("rellllllllll",p1);

    const { currentTranslate, currentZoomFactor } = this.getTransform();
    console.log("transform: ",currentTranslate, currentZoomFactor)
    const { evData } = this;
    const { xMid, yMid } = evData;    this.resizeStartPoint = p1;
    this.resizeStartTranslate = currentTranslate;
    this.resizeStartZoomFactor = currentZoomFactor;
    this.mouseDownOnCrop = true;
    let startPos: Point.Point, area: string = "", endPos: Point.Point;
    startPos = this.getAbsolutePos(p1);
    endPos = Point.sum(this.evData.offset, {
        x: this.evData.curWidth,
        y: this.evData.curHeight
    });
    console.log('beforeeeeeee', endPos);
    endPos = this.getRelativePos(endPos);
    console.log('afterrrrrrrr',endPos)
    area += (yMid > startPos.y) ? "u" : "d";
    area += (xMid > startPos.x) ? "l" : "r";
    this.resizeStartArea = area;
    console.log("ord: ",area, "mid: ", xMid, yMid, "touch: ", startPos)
    this.evData = {
        ...this.evData,
        startPos,
        ord : area
    };
    this.setState({
        drawIsActive: true
      });
  }

  private crossOverCheck(pos: Point.Point) {
    const { evData } = this;
    const { ord, offset } = evData;
    let newPos: Point.Point = pos;
    let xCrossOver = false, yCrossOver = false;
    if (ord.includes("u") && pos.y >= offset.y + evData.curHeight) {
      newPos.y = offset.y + evData.curHeight;
      yCrossOver = true;
    }
    else if (ord.includes("d") && pos.y <= offset.y) {
      newPos.y = offset.y;
      yCrossOver = true;
    } else {
      newPos.y = pos.y;
    }

    if (ord.includes("r") && pos.x <= offset.x) {
      newPos.x = offset.x;
      xCrossOver = true;
    }
    else if (ord.includes("l") && pos.x >= offset.x + evData.curWidth) {
      newPos.x = offset.x + evData.curWidth;
      xCrossOver = true;
    } else {
      newPos.x = pos.x;
    }

    this.evData = {
      ...this.evData,
      xCrossOver,
      yCrossOver,
      curPos : newPos
    };
    this.resizeEvData();
  }

  private resizeEvData() {
      const { curPos, startPos, curWidth, curHeight, ord, offset } = this.evData;
      let newOffset: Point.Point = offset, newHeight: number = curHeight, newWidth: number = curWidth, 
            diff: Point.Point, midPoint: Point.Point;
      diff = Point.offset(curPos, startPos);
    //   console.log("difffffff", diff);
      
      if (ord.includes("l")) {
          newOffset.x = offset.x + diff.x;
          newOffset.x = clamp(0,newOffset.x,this.canvWidth);
          if (newOffset.x != 0 || newOffset.x != this.canvWidth) {
            newWidth = curWidth - diff.x;
          }
      } else if (ord.includes("r")) {
          if (offset.x + curWidth + diff.x < this.canvWidth)
            newWidth = curWidth + diff.x;
      }
      if (ord.includes("u")) {
          newOffset.y = offset.y + diff.y;
          newOffset.y = clamp(0,newOffset.y,this.canvHeight);
          if (newOffset.y != 0 || newOffset.y != this.canvHeight) {
            newHeight = curHeight - diff.y;
          }
      } else if (ord.includes("d")) {
          if (newOffset.y + newHeight + diff.y < this.canvHeight)
          newHeight = curHeight + diff.y;
      }
      newWidth = clamp(0,newWidth,this.canvWidth);
      newHeight = clamp(0,newHeight,this.canvHeight);
      midPoint = {
          x: newOffset.x + newWidth / 2,
          y: newOffset.y + newHeight / 2
      };
      this.evData = {
          ...this.evData,
          startPos: curPos,
          offset: newOffset,
          curWidth: newWidth,
          curHeight: newHeight,
          xDif: diff.x,
          yDif: diff.y,
          xMid: midPoint.x,
          yMid: midPoint.y
      }
      this.setState({
          lastSingleTouchPoint: curPos
      })
  } 

  public onResizeBoxMove(syntheticEvent: React.SyntheticEvent) {
    const { moveMode } = this.props;
    const { isRect } = this.state;
    if (moveMode || !this.mouseDownOnCrop || !isRect) {
      return;
    }
    const [dragPoint] = CustomPinchToZoom.getTouchesCoordinate(syntheticEvent);
    const { currentTranslate } = this.getTransform();
    let absDragPoint = this.getAbsolutePos(dragPoint);
    let dir:string = this.isPanAvailable();
    console.log("Pan direction", dir )

    this.crossOverCheck(absDragPoint);
    this.setState({
        lastSingleTouchPoint: dragPoint
    })
    // panContentArea(nextTranslate)
  }


  public onResizeBoxEnd() {
    const { isRect } = this.state;
    if ( !isRect ) {
      console.log('resize end error');
      return;
    }
    this.drawStarted = false;
    this.mouseDownOnCrop = false;
    this.evData = {
        ...this.evData,
        isResize: true,
        startPos : Point.newOriginPoint(),
        prevPos : Point.newOriginPoint(),
        curPos : Point.newOriginPoint(),
        ord : "",
        xCrossOver : false,
        yCrossOver : false,
        xInversed : false,
        yInversed : false,
        xDif : 0,
        yDif : 0
    };
    let midPoint: Point.Point = {
        x: this.evData.xMid,
        y: this.evData.yMid
    }
    let scale: number = Math.max( this.canvWidth, this.canvHeight) /
    (Math.max( this.evData.curWidth, this.evData.curHeight ) * 3);
    scale = (scale < 1) ? 1 : scale;
    this.customZoomToPosition(
        this.getRelativePos(midPoint), scale);
    this.setState({
        drawIsActive : false,
      })
  }



  public onPinchPanStart(syntheticEvent: React.SyntheticEvent) {
    const [p1, p2] = CustomPinchToZoom.getTouchesCoordinate(syntheticEvent);
    // on pinch start remember the mid point of 2 touch points
    this.pinchStartTouchMidpoint = Point.midpoint(p1, p2);
    this.panStartPoint = p1;

    // on pinch start remember the distance of 2 touch points
    this.pinchStartTouchPointDist = Point.distance(p1, p2);

    /*
      on pinch start, remember the `origianl zoom factor`
      & `origianl plan translate` before pinching
    */
    const { currentZoomFactor, currentTranslate } = this.getTransform();
    this.pinchStartZoomFactor = currentZoomFactor;
    this.pinchStartTranslate = currentTranslate;
    this.panStartTranslate = currentTranslate;
  }

  public onPinchPanMove(syntheticEvent: React.SyntheticEvent) {
    // get lastest touch point coordinate
    const [p1, p2] = CustomPinchToZoom.getTouchesCoordinate(syntheticEvent);
    const dragPoint = p1;
    const { currentZoomFactor } = this.getTransform();
    const origin = this.panStartPoint;
    const prevTranslate = this.panStartTranslate;
    const dragOffset = Point.offset(dragPoint, origin);
    const adjustedZoomOffset = Point.scale(dragOffset, 1 / currentZoomFactor);
    const nextTranslate = Point.sum(adjustedZoomOffset, prevTranslate);
    this.panContentArea(nextTranslate);

    // const pinchCurrentTouchMidpoint = SeatingPlan.calculateMidpoint({ x1, y1 }, { x2, y2 });

    const pinchCurrentTouchPointDist = Point.distance(p1, p2);

    // delta > 0: enlarge(zoon in), delta < 0: diminish(zoom out)
    const deltaTouchPointDist =
      pinchCurrentTouchPointDist - this.pinchStartTouchPointDist;

    // update zoom factor
    const newZoomFactor =
      this.pinchStartZoomFactor + deltaTouchPointDist * 0.01;
    this.zoomContentArea(newZoomFactor);
  }
  public onPinchPanEnd() {
    this.guardZoomAreaScale();
    this.guardZoomAreaTranslate();
  }

  /* validate zoom factor value */
  public guardZoomAreaScale() {
    const { currentZoomFactor } = this.getTransform();
    const { minZoomScale, maxZoomScale } = this.props;
    if (currentZoomFactor > maxZoomScale) {
      this.zoomContentArea(maxZoomScale);
    } else if (currentZoomFactor < minZoomScale) {
      this.zoomContentArea(minZoomScale);
    }
  }

  /* validate translate value */
  public guardZoomAreaTranslate() {
    if (!this.zoomAreaContainer || !this.zoomArea) {
      return;
    }
    const { currentZoomFactor, currentTranslate } = this.getTransform();
    const { minZoomScale } = this.props;
    const {
      clientWidth: containerW,
      clientHeight: containerH
    } = this.zoomAreaContainer;
    const { clientWidth: contentW, clientHeight: contentH } = this.zoomArea;
    if (currentZoomFactor < minZoomScale) {
      return;
    }

    // container size
    const boundSize = {
      width: containerW,
      height: containerH
    };

    // content size adjusted to zoom factor
    const contentSize = Size.scale(
      {
        width: contentW,
        height: contentH
      },
      currentZoomFactor
    );

    const diff = Size.diff(boundSize, contentSize);
    const diffInPoint = Size.toPoint(diff);

    const unitScaleLeftTopPoint = Point.scale(
      diffInPoint,
      1 / (2 * currentZoomFactor)
    );

    const maxLeftTopPoint = Point.boundWithin(
      Point.newOriginPoint(),
      unitScaleLeftTopPoint,
      Point.map(unitScaleLeftTopPoint, truncRound)
    );

    const unitScaleRightBottomPoint = Point.scale(
      diffInPoint,
      1 / currentZoomFactor
    );

    const maxRightBottomPoint = {
      x: Math.min(unitScaleRightBottomPoint.x, maxLeftTopPoint.x),
      y: Math.min(unitScaleRightBottomPoint.y, maxLeftTopPoint.y)
    };

    const validatePos = Point.boundWithin(
      maxRightBottomPoint,
      currentTranslate,
      maxLeftTopPoint
    );

    if (!Point.isEqual(validatePos, currentTranslate)) {
      this.panContentArea(validatePos);
    }
  }

  /* perform pan transfrom */
  public panContentArea(pos: Point.Point) {
    this.setTransform({
      translate: pos
    });
  }

  /* perform zooming transfrom */
  public zoomContentArea(zoomFactor: number) {
    if (!this.zoomAreaContainer || !this.zoomArea) {
      return;
    }
    // calculate delta translate needed
    const prevZoomFactor = this.pinchStartZoomFactor;
    const prevTranslate = this.pinchStartTranslate;
    const {
      clientWidth: containerW,
      clientHeight: containerH
    } = this.zoomAreaContainer;

    const boundSize = {
      width: containerW,
      height: containerH
    };

    const prevZoomSize = Size.scale(boundSize, prevZoomFactor);
    const nextZoomSize = Size.scale(boundSize, zoomFactor);

    const prevRectCenterPoint = {
      x: prevZoomSize.width / 2,
      y: prevZoomSize.height / 2
    };

    const nextRectCenterPoint = {
      x: nextZoomSize.width / 2,
      y: nextZoomSize.height / 2
    };

    const deltaTranslate = Point.scale(
      Point.offset(prevRectCenterPoint, nextRectCenterPoint),
      1 / (zoomFactor * prevZoomFactor)
    );

    const accumulateTranslate = Point.sum(deltaTranslate, prevTranslate);

    // update zoom scale and corresponding translate
    this.setTransform({
      zoomFactor: truncRound(zoomFactor),
      translate: accumulateTranslate
    });
  }

  /*
    event handlers
  */

  public handleTouchStart(syntheticEvent: React.SyntheticEvent) {
    if (!this.zoomAreaContainer || !this.zoomArea) {
      return;
    }
    const { nativeEvent } = syntheticEvent;
    const { moveMode } = this.props;
    const { isRect } = this.state;
    if (!(nativeEvent instanceof TouchEvent)) {
      return;
    }
    this.zoomArea.style.transitionDuration = "0.0s";
    // 2 touches == pinch, else all considered as pan
    switch (nativeEvent.touches.length) {
      case 2:
        this.currentGesture = GUESTURE_TYPE.PINCH;
        this.onPinchPanStart(syntheticEvent);
        break;
      default: {
        /* don't allow pan if zoom factor === minZoomScale */
        const [p1] = CustomPinchToZoom.getTouchesCoordinate(syntheticEvent);
        this.setState({ lastSingleTouchPoint: p1 });
        if (moveMode) {
          this.currentGesture = GUESTURE_TYPE.PAN;
          this.onPanStart(syntheticEvent);
        }
        else if (isRect) {
          this.currentGesture = GUESTURE_TYPE.RESIZE;
          this.onResizeBoxStart(syntheticEvent);
        } else {
          this.currentGesture = GUESTURE_TYPE.DRAW;
          this.onDrawBoxStart(syntheticEvent);
        }
      }
    }
  }

  public handleTouchMove(syntheticEvent: React.SyntheticEvent) {
    // 2 touches == pinch, else all considered as pan
    const { nativeEvent } = syntheticEvent;
    const { moveMode } = this.props
    const { isRect } = this.state;
    if (!(nativeEvent instanceof TouchEvent)) {
      return;
    }
    switch (nativeEvent.touches.length) {
      case 2:
        if (this.currentGesture === GUESTURE_TYPE.PINCH) {
          this.onPinchPanMove(syntheticEvent);
        }
        break;
      default:
        if (this.currentGesture === GUESTURE_TYPE.PAN) {
          if (moveMode) this.onPanMove(syntheticEvent);
        }
        else if (this.currentGesture === GUESTURE_TYPE.DRAW) {
            this.onDrawBoxMove(syntheticEvent);
        }
        else if (this.currentGesture === GUESTURE_TYPE.RESIZE) {
          if (isRect) {
            this.onResizeBoxMove(syntheticEvent);
          }
        }
    }
  }

  public handleTouchEnd(syntheticEvent: React.SyntheticEvent) {
    const { moveMode } = this.props
    const { isRect } = this.state;
    if (!this.zoomAreaContainer || !this.zoomArea) {
      return;
    }
    this.zoomArea.style.transitionDuration = "0.3s";
    if (this.currentGesture === GUESTURE_TYPE.PINCH) {
      this.onPinchPanEnd();
    }
    if (this.currentGesture === GUESTURE_TYPE.PAN) {
      if( moveMode ) this.onPanEnd();
    }
    else if (this.currentGesture === GUESTURE_TYPE.DRAW) {
        this.onDrawBoxEnd();
    } else if (this.currentGesture === GUESTURE_TYPE.RESIZE) {
      if (isRect) {
        this.onResizeBoxEnd();
      } 
    }
    this.currentGesture = GUESTURE_TYPE.UNSET;
  }

  public autoZoomToLastTouchPoint() {
    const { lastSingleTouchPoint } = this.state;
    if (lastSingleTouchPoint.x === 0 && lastSingleTouchPoint.y === 0) {
      return;
    }
    this.autoZoomToPosition(lastSingleTouchPoint);
  }

  // auto zoom
  public autoZoomToPosition(pos: Point.Point) {
    if (!this.zoomAreaContainer || !this.zoomArea) {
      return;
    }
    const autoZoomFactor = 2.0;
    const { currentZoomFactor, currentTranslate } = this.getTransform();
    const zoomAreaContainerW = this.zoomAreaContainer.clientWidth;
    const zoomAreaContainerH = this.zoomAreaContainer.clientHeight;

    // calculate target points with respect to the zoomArea coordinate
    // & adjust to current zoomFactor + existing translate
    const zoomAreaX =
      (pos.x / currentZoomFactor - currentTranslate.x) * autoZoomFactor;
    const zoomAreaY =
      (pos.y / currentZoomFactor - currentTranslate.y) * autoZoomFactor;

    // calculate distance to translate the target points to zoomAreaContainer's center
    const deltaX = zoomAreaContainerW / 2 - zoomAreaX;
    const deltaY = zoomAreaContainerH / 2 - zoomAreaY;

    // adjust to the new zoomFactor
    const inScaleTranslate = {
      x: deltaX / autoZoomFactor,
      y: deltaY / autoZoomFactor
    };

    // update zoom scale and corresponding translate
    this.zoomArea.style.transitionDuration = "0.3s";
    this.setTransform({
      zoomFactor: autoZoomFactor,
      translate: {
        x: inScaleTranslate.x,
        y: inScaleTranslate.y
      }
    });
    this.guardZoomAreaTranslate();
  }

  public customZoomToPosition(pos: Point.Point, zFactor: number) {
    if (!this.zoomAreaContainer || !this.zoomArea) {
      return;
    }
    const { currentZoomFactor, currentTranslate } = this.getTransform();
    const zoomAreaContainerW = this.zoomAreaContainer.clientWidth;
    const zoomAreaContainerH = this.zoomAreaContainer.clientHeight;

    // calculate target points with respect to the zoomArea coordinate
    // & adjust to current zoomFactor + existing translate
    const zoomAreaX =
      (pos.x / currentZoomFactor - currentTranslate.x) * zFactor;
    const zoomAreaY =
      (pos.y / currentZoomFactor - currentTranslate.y) * zFactor;

    // calculate distance to translate the target points to zoomAreaContainer's center
    const deltaX = zoomAreaContainerW / 2 - zoomAreaX;
    const deltaY = zoomAreaContainerH / 2 - zoomAreaY;

    // adjust to the new zoomFactor
    const inScaleTranslate = {
      x: deltaX / zFactor,
      y: deltaY / zFactor
    };

    // update zoom scale and corresponding translate
    this.zoomArea.style.transitionDuration = "0.3s";
    this.setTransform({
      zoomFactor: zFactor,
      translate: {
        x: inScaleTranslate.x,
        y: inScaleTranslate.y
      }
    });
    this.guardZoomAreaTranslate();
  }

  /*
    update zoom area transform
  */
  public setTransform({
    zoomFactor = this.transform.zoomFactor,
    translate = {
      x: this.transform.translate.x,
      y: this.transform.translate.y
    }
  } = {}) {
    if (!this.zoomAreaContainer || !this.zoomArea) {
      return;
    }
    const roundTransalteX = Math.round(translate.x * 1000) / 1000;
    const roundTransalteY = Math.round(translate.y * 1000) / 1000;

    // don't allow zoomFactor smaller then this.props.minZoomScale * 0.8
    if (zoomFactor < this.props.minZoomScale * 0.8) {
      return;
    }

    // update the lastest transform value
    this.transform.zoomFactor = zoomFactor;
    this.transform.translate.x = roundTransalteX;
    this.transform.translate.y = roundTransalteY;
    // update the transform style
    const styleString = `
        scale(${zoomFactor})
        translate(${roundTransalteX}px, ${roundTransalteY}px)
        translateZ(${0})
      `;

    this.zoomArea.style.transform = styleString;
    this.zoomArea.style.webkitTransform = styleString;
  }

  /*
    get a *copy* of current zoom area transformation value
  */
  public getTransform() {
    const { zoomFactor, translate } = this.transform;
    return {
      currentZoomFactor: zoomFactor,
      currentTranslate: {
        x: translate.x,
        y: translate.y
      }
    };
  }

  /*
    React render
  */

  public render() {
    const { debug, disableWork, className, children } = this.props;
    const { currentZoomFactor, currentTranslate } = this.getTransform();
    const classNameList = ["", "pinch-to-zoom-container"];

    const containerInlineStyle = {
      display: "inline-block",
      overflow: "hidden",
      backgroundColor: "inherit"
    };

    const zoomAreaInlineStyle = {
      display: "inline-block",
      willChange: "transform",
      transformOrigin: "0px 0px 0px",
      transition: "transform 0ms ease",
      transitionTimingFunction: "cubic-bezier(0.1, 0.57, 0.1, 1)",
      transitionDuration: "0ms",
      perspective: 1000,
      width: "100%" // match `pinch-to-zoom-container` width
    };
    const { canvRef } = this.props;
    if (debug) {
      classNameList.push("debug");
      containerInlineStyle.backgroundColor = "red";
    }

    return (
      <div
        className={className.concat(classNameList.join(" "))}
        style={containerInlineStyle}
        onTouchStart={e => this.handleTouchStart(e)}
        onTouchMove={e => this.handleTouchMove(e)}
        onTouchEnd={e => this.handleTouchEnd(e)}
        ref={c => {
          this.zoomAreaContainer = c || undefined;
        }}
      >
        <div
          className="pinch-to-zoom-area"
          style={zoomAreaInlineStyle}
          ref={c => {
            this.zoomArea = c || undefined;
          }}
        >
          <BoxCanvas
            style={{ position: "relative" }}
            url={this.props.src}
            canvRef = {this.canv}
            isRect = {this.state.isRect}
            zFactor = {currentZoomFactor}
            translate = {currentTranslate}
            evData = {this.evData}
          />
        </div>
      </div>
    );
  }
}

CustomPinchToZoom.defaultProps = {
  debug: false,
  // moveMode: true,
  className: "",
  minZoomScale: 1.0,
  maxZoomScale: 4.0,
  boundSize: {
    width: 100,
    height: 100
  },
  contentSize: {
    width: 100,
    height: 100
  },
};

CustomPinchToZoom.propTypes = {
  debug: PropTypes.bool,
  // moveMode: PropTypes.bool.isRequired,
  isRect: PropTypes.bool,
  disableWork: PropTypes.bool,
  className: PropTypes.string,
  minZoomScale: PropTypes.number,
  maxZoomScale: PropTypes.number,
  boundSize: PropTypes.shape({
    // bound size is the out touch area size
    // the width should match device's width e.g. 320 for iphone 5
    width: PropTypes.number, // eslint-disable-line
    height: PropTypes.number // eslint-disable-line
  }),
  contentSize: PropTypes.shape({
    // content size is the inner content initial size
    // the width should match the inner content element's width when scale is 1
    width: PropTypes.number, // eslint-disable-line
    height: PropTypes.number // eslint-disable-line
  }),
  children: PropTypes.func,
};

export default CustomPinchToZoom;
