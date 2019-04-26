/**
 * PinchToZoom react componenets
 */

import * as PropTypes from "prop-types";
import * as React from "react";
import * as Point from "./Point";
import * as Size from "./Size";
import BoxCanvas from "../BoxCanvas";
import { O_RDONLY } from "constants";

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
  top : number,
  left : number
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
  yCrossOver: boolean,
  startXCrossOver: boolean,
  startYCrossOver: boolean,
  ord: string,
  isResize: boolean,
  offset: CropOffset
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
  startDrawTouchPoint: Point.Point;
  endDrawTouchPoint: Point.Point;
  zoomDrawTouchPoint: Point.Point;
  zoomDrawFactor: number;
  zoomResizeFactor: number;
  zoomRect:CanvasRect;
  prevRect:CanvasRect;
  isRect: boolean;
  ord: string;
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

  //pinch & pan
  public pinchPanStartZoomFactor: number;
  public pinchPanStartTouchMidpoint: Point.Point;
  public pinchPanStartTranslate: Point.Point;
  public pinchPanStartTouchPointDist: number;

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
  private evData: CropRect;
  private drawStarted: boolean;
  private mouseDownOnCrop: boolean;
  public drawCanvas: Function;
  private canvWidth: number;
  private canvHeight: number;
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

    // instance variable: pinchpan
    this.pinchPanStartZoomFactor = 1.0;
    this.pinchPanStartTouchMidpoint = Point.newOriginPoint();
    this.pinchPanStartTranslate = Point.newOriginPoint();
    this.pinchPanStartTouchPointDist = 0;

    // instance variable: pan
    this.panStartPoint = Point.newOriginPoint();
    this.panStartTranslate = Point.newOriginPoint();
    this.drawStarted = false;
    this.mouseDownOnCrop = false;
    this.evData = {
      startPos: Point.newOriginPoint(),
      startWidth: 0,
      startHeight: 0,
      absPos: Point.newOriginPoint(),
      absWidth: 0,
      absHeight: 0,
      xDif: 0,
      yDif: 0,
      midX: 0,
      midY: 0,
      xInversed: false,
      yInversed: false,
      xCrossOver: false,
      yCrossOver: false,
      startXCrossOver: false,
      startYCrossOver: false,
      ord:"nw",
      isResize: false,
      offset: {
        top:0,
        left:0
      }
    }
    // record last touch point
    this.state = {
      lastSingleTouchPoint: Point.newOriginPoint(),
      isRect : false,
      startDrawTouchPoint: Point.newOriginPoint(),
      endDrawTouchPoint: Point.newOriginPoint(),
      zoomDrawTouchPoint: Point.newOriginPoint(),
      zoomDrawFactor: 1,
      zoomResizeFactor: 1,
      drawIsActive: false,
      zoomRect: {
        pos: Point.newOriginPoint(),
        width: 0,
        height: 0
      },
      prevRect: {
        pos: Point.newOriginPoint(),
        width: 0,
        height: 0
      },
      ord: "nw"
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

  public onDrawBoxStart(syntheticEvent: React.SyntheticEvent) {
    const { moveMode } = this.props;
    const { isRect } = this.state;
    if (moveMode || isRect) {
      return;
    }
    const [p1] = CustomPinchToZoom.getTouchesCoordinate(syntheticEvent);
    const { currentZoomFactor, currentTranslate } = this.getTransform();
    let absRect : CanvasRect;
    absRect = this.getAbsoluteTransform(p1, 0, 0);
    this.evData = {
      startPos: absRect.pos,
      absPos: absRect.pos,
      absWidth: absRect.width,
      absHeight: absRect.height,
      offset: {
        top: 0,
        left: 0
      },
      startWidth: 0,
      startHeight: 0,
      xDif: 0,
      yDif: 0,
      midX: 0,
      midY: 0,
      xInversed: false,
      yInversed: false,
      xCrossOver: false,
      yCrossOver: false,
      startXCrossOver: false,
      startYCrossOver: false,
      isResize: false,
      ord: "nw"
    };

    this.mouseDownOnCrop = true;
    this.setState({
      drawIsActive: true
    });

  }
  // private straightenYPath(clientX: number): number {
  //   const {evData} = this;
  //   const { ord, offset } = evData;
  //   const startWidth = 
  //     (evData.startWidth / 100) * this.canv.current!.width | evData.startWidth;
  //   const startHeight = 
  //     (evData.startHeight / 100) * this.canv.current!.height | evData.startHeight;
  //   let k;
  //   let d;

  //   if (ord === "nw" || ord === "se") {
  //     k = startHeight / startWidth;
  //     d = offset.top - offset.left * k;
  //   } else {
  //     k = -startHeight / startWidth;
  //     d = offset.top + (startHeight - offset.left * k);
  //   }
    
  //   return k * clientX + d;
  // }
  public onDrawBoxMove(syntheticEvent: React.SyntheticEvent) {
    const { moveMode } = this.props;
    const { isRect } = this.state;
    if (moveMode || !this.mouseDownOnCrop || isRect) {
      return;
    }
    const { evData } = this;
    const [p1] = CustomPinchToZoom.getTouchesCoordinate(syntheticEvent);
    let absPos: Point.Point;
    absPos = this.getAbsolutePos(p1);

    // I don`t know 
    // if (evData.isResize && evData.offset) {
    //   p1.y = this.straightenYPath(p1.x);
    // }
    new Promise<boolean>((res, rej) => {
    res(true);
    }).then(res=>{
      this.setState({
        endDrawTouchPoint: p1
      });
    }).then(res=>{
      this.updateZoomRect(absPos);
    }).then(res=>{
      // this.drawRect();
    }).catch(rej=>{
      console.error('Error on Drawing Rectangle');
    })
    
  }

  private getOffset() {
    const { evData } = this;
    // const { ord, startPos } = evData;
    const { ord, absPos } = evData;
    let top, left;
    top = ord.includes("n") ? absPos.y : absPos.y - evData.absHeight;
    left = ord.includes("w") ? absPos.x : absPos.x - evData.absWidth;
    
    this.evData = {
      ...this.evData,
      offset : {
        top : top,
        left : left
      }
    }
  }
  private updateZoomRect(pos: Point.Point) {
    // block CrossOver
    const { evData } = this;
    const { startPos, startHeight, startWidth } = evData;
    const { absPos, absHeight, absWidth, offset } = evData;
    const { currentZoomFactor, currentTranslate } = this.getTransform();

    let xInversed, yInversed, xDif, yDif;
    let ord = "";
    xDif = pos.x - absPos.x;
    yDif = pos.y - absPos.y;
    xInversed = xDif > 0 ? false : true;
    yInversed = yDif > 0 ? false : true;

    if (yInversed) {
      ord += "s";
    } else {
      ord += "n";
    }
    if (xInversed) {
      ord += "e";
    } else {
      ord += "w";
    }
    this.getOffset()
    this.evData = {
      ...this.evData,
      absHeight : Math.abs(yDif),
      absWidth : Math.abs(xDif),
      xDif: Math.abs(xDif) - absWidth,
      yDif: Math.abs(xDif) - absHeight,
      ord,
      xInversed,
      yInversed,
    }
  }

  public onDrawBoxEnd() {
    const { evData } = this;
    const { offset } = evData;
    const { isRect } = this.state;
    if ( isRect ) {
      return;
    }
    this.setState({
      drawIsActive : false,
      isRect: true,
    })
    this.drawStarted = false;
    this.mouseDownOnCrop = false;
    let midX, midY, relMid: Point.Point, absRect:CanvasRect;
    midX = offset.left + evData.absWidth / 2;
    midY = offset.top + evData.absHeight / 2;
    // absRect = this.getAbsoluteTransform(evData.startPos,evData.startWidth,evData.startHeight);
    this.evData = {
      ...this.evData,
      // absPos: evData.startPos,
      // absHeight: absRect.height,
      // absWidth: absRect.width,
      midX,
      midY
    }
    // relMid = this.getRelativePos({ x: midX, y: midY })
    // console.log("mid",midX,midY, relMid);
    this.autoZoomToPosition({ x: midX, y: midY })
  }
  
  public onResizeBoxStart(syntheticEvent: React.SyntheticEvent) {
    //block
    if (!this.state.isRect || this.props.moveMode) {
      console.log('Resize Not starting...')
      return;
    }
    const [p1] = CustomPinchToZoom.getTouchesCoordinate(syntheticEvent);
    const { evData } = this;
    const { offset, midX, midY } = evData;
    let absPos:Point.Point, ord="";
    absPos = this.getAbsolutePos(p1);
    if (midY >= absPos.y) ord += "n"; else ord += "s";
    if (midX >= absPos.x) ord += "w"; else ord += "e";
    this.evData = {
      ...this.evData,
      startPos : absPos,
      isResize : true,
      ord,
      xDif : 0,
      yDif : 0,
      xInversed: false,
      yInversed: false,
      xCrossOver: false,
      yCrossOver: false,
      startXCrossOver: false,
      startYCrossOver: false,
      offset
    }

    this.mouseDownOnCrop = true;
  }

  public crossOverCheck(pos: Point.Point) {
    const { evData } = this;
    const { ord, offset } = evData;
    let newPos: Point.Point = {x:0,y:0};
    let xCrossOver = false, yCrossOver = false;
    if (ord.includes("n") && pos.y >= offset.top + evData.absHeight) {
      newPos.y = offset.top + evData.absHeight;
      yCrossOver = true;
    }
    else if (ord.includes("s") && pos.y <= offset.top) {
      newPos.y = offset.top;
      yCrossOver = true;
      console.log('yCross')
    } else {
      newPos.y = pos.y;
    }

    if (ord.includes("e") && pos.x <= offset.left) {
      newPos.x = offset.left;
      xCrossOver = true;
      console.log('xCross')
    }
    else if (ord.includes("w") && pos.x >= offset.left + evData.absWidth) {
      newPos.x = offset.left + evData.absWidth;
      xCrossOver = true;
    } else {
      newPos.x = pos.x;
    }

    this.evData = {
      ...this.evData,
      xCrossOver,
      yCrossOver
    }

    return newPos;
  }

  public onResizeBoxMove(syntheticEvent: React.SyntheticEvent) {
    if (!this.state.isRect || !this.mouseDownOnCrop || this.props.moveMode ) {
      return;
    }
    const [p1] = CustomPinchToZoom.getTouchesCoordinate(syntheticEvent);
    const { evData } = this;
    const { startPos, ord } = evData;
    let pos: Point.Point;
    // pos = this.getAbsolutePos(p1);
    pos = this.crossOverCheck(p1);
    let xDif, yDif;
    xDif = (pos.x - startPos.x) * 1; 
    yDif = (pos.y - startPos.y) * 1;
    let newOffset = evData.offset;
    let newWidth = evData.absWidth, newHeight = evData.absHeight;
    // left, top을 변경시킬 때, 박스가 흔들리는 부분 수정해주어야 함.
    if (ord.includes("w")) {
      let right = evData.offset.left + evData.absWidth
      right -= xDif;
      newWidth = right - evData.offset.left;
      newWidth = newWidth > 0 ? newWidth : 0;
      newOffset.left += newWidth > 0 ? xDif : 0;
      // newWidth -= xDif;
    } else {
      newWidth += xDif;
    }
    if (ord.includes("n")) {
      newHeight -= yDif;
      newHeight = newHeight > 0 ? newHeight : 0;
      newOffset.top += newHeight > 0 ? yDif : 0;
    } else {
      newHeight += yDif;
    }
    newWidth = clamp(0,newWidth,this.canvWidth);
    newHeight = clamp(0,newHeight,this.canvHeight);
    // add update ord.
    let midX, midY, absRect:CanvasRect;
    midX = newOffset.left + newWidth / 2;
    midY = newOffset.top + newHeight / 2;
    console.log(midX,midY,pos,newOffset,ord)
    absRect = this.getAbsoluteTransform(
      {
        x: newOffset.left,
        y: newOffset.top,
      } ,newWidth,newHeight
      );

    this.evData = {
      ...this.evData,
      startPos: pos,
      midX,
      midY,
      xDif,
      yDif,
      absPos: pos,
      absWidth: newWidth,
      absHeight: newHeight,
      offset: newOffset,
      startHeight: newHeight,
      startWidth: newWidth
    };
    this.setState({
      lastSingleTouchPoint: pos
    });
  }


  public onResizeBoxEnd() {
    const { evData } = this;
    const { offset } = evData;
    const { currentZoomFactor, currentTranslate } = this.getTransform();
    this.mouseDownOnCrop = false;
    //set default with (isResize), drawStarted?
    //zoom
    let midX, midY;
    midX = offset.left + evData.startWidth / 2;
    midY = offset.top + evData.startHeight / 2;
    this.evData = {
      ...this.evData,
      midX,
      midY,
    }
    this.setState({
      drawIsActive: false
    })

    console.log("Transform: ",currentZoomFactor, currentTranslate);
    // this.autoZoomToPosition({ x: midX, y: midY })
    // console.log(offset)

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
    // console.log(this.evData);
    if (debug) {
      classNameList.push("debug");
      containerInlineStyle.backgroundColor = "red";
    }

    // if (!children || typeof children !== "function") {
    //   throw new Error(`ProgressiveImage requires a function as its only child`);
    // }
    // console.log(children);
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
          {/* {canvRef} */}
          <BoxCanvas
            style={{ position: "relative" }}
            url={this.props.src}
            canvRef = {this.canv}
            isRect = {this.state.isRect}
            // getAbsoluteTransform = {this.getAbsoluteTransform}
            zFactor = {currentZoomFactor}
            translate = {currentTranslate}
            evData = {this.evData}
          />
          {/* {children(this.transform.zoomFactor)} */}
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
