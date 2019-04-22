/**
 * PinchToZoom react componenets
 */

import * as PropTypes from "prop-types";
import * as React from "react";
import * as Point from "./Point";
import * as Size from "./Size";
import BoxCanvas from "../BoxCanvas";
import { start } from "repl";

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
  xDif: number,
  yDif: number,
  xInversed: boolean,
  yInversed: boolean,
  xCrossOver: boolean,
  yCrossover: boolean,
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
  constructor(props: PinchToZoomProps) {
    super(props);
    // instance variable: transform data
    this.transform = {
      zoomFactor: 1.0,
      translate: Point.newOriginPoint()
    };

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
      xDif: 0,
      yDif: 0,
      xInversed: false,
      yInversed: false,
      xCrossOver: false,
      yCrossover: false,
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
    if (moveMode) {
      return;
    }
    const [p1] = CustomPinchToZoom.getTouchesCoordinate(syntheticEvent);

    this.evData = {
      startPos: p1,
      offset: {
        top: 0,
        left: 0
      },
      startWidth: 0,
      startHeight: 0,
      xDif: 0,
      yDif: 0,
      xInversed: false,
      yInversed: false,
      xCrossOver: false,
      yCrossover: false,
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
  private straightenYPath(clientX: number): number {
    const {evData} = this;
    const { ord, offset } = evData;
    const startWidth = 
      (evData.startWidth / 100) * this.canv.current!.width | evData.startWidth;
    const startHeight = 
      (evData.startHeight / 100) * this.canv.current!.height | evData.startHeight;
    let k;
    let d;

    if (ord === "nw" || ord === "se") {
      k = startHeight / startWidth;
      d = offset.top - offset.left * k;
    } else {
      k = -startHeight / startWidth;
      d = offset.top + (startHeight - offset.left * k);
    }
    
    return k * clientX + d;
  }
  public onDrawBoxMove(syntheticEvent: React.SyntheticEvent) {
    const { moveMode } = this.props;
    const { startDrawTouchPoint } = this.state;
    if (moveMode || !this.mouseDownOnCrop) {
      return;
    }
    const { evData } = this;
    const [p1] = CustomPinchToZoom.getTouchesCoordinate(syntheticEvent);

    // I don`t know 
    if (evData.isResize && evData.offset) {
      p1.y = this.straightenYPath(p1.x);
    }
    new Promise<boolean>((res, rej) => {
    res(true);
    }).then(res=>{
      this.setState({
        endDrawTouchPoint: p1
      });
    }).then(res=>{
      this.updateZoomRect(p1);
    }).then(res=>{
      this.drawRect();
    }).catch(rej=>{
      console.error('Error on Drawing Rectangle');
    })
    
  }

  private drawRect() {
    const { zoomRect, prevRect,zoomDrawFactor } = this.state;
    const { evData } = this;
    const { offset } = evData;
    let prevX, prevY;
    prevX = evData.startWidth + evData.xDif
    prevY = evData.startHeight + evData.yDif
    const canvas = this.canv.current;
    const ctx = canvas!.getContext("2d");
    if (ctx) {
      console.log('drawing...')
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.moveTo(offset.left,offset.top);
      ctx.lineTo(offset.left + evData.startWidth, offset.top);
      ctx.lineTo(offset.left + evData.startWidth, offset.top + evData.startHeight);
      ctx.lineTo(offset.left, offset.top + evData.startHeight);
      ctx.lineTo(offset.left,offset.top);
      ctx.closePath();
      ctx.stroke();
      // ctx.globalCompositeOperation='destination-over';
      // ctx.clearRect(offset.left, offset.top, prevX, prevY);
      // ctx.strokeRect(offset.left, offset.top, evData.startWidth, evData.startHeight);  
    }
    // this.zoomContentArea(zoomDrawFactor);
  }
  private getOffset() {
    const { evData } = this;
    const { ord, startPos } = evData;
    let top, left;
    top = ord.includes("s") ? startPos.y : startPos.y - evData.startHeight;
    left = ord.includes("e") ? startPos.x : startPos.x - evData.startWidth;
    
    this.evData = {
      ...this.evData,
      offset : {
        top : top,
        left : left
      }
    }
  }
  private updateZoomRect(pos: Point.Point) {
    const { evData } = this;
    const { startPos, startHeight, startWidth } = evData;
    let xInversed, yInversed, xDif, yDif;
    let ord = "";
    xDif = pos.x - startPos.x;
    yDif = pos.y - startPos.y;
    xInversed = xDif > 0 ? false : true;
    yInversed = yDif > 0 ? false : true;

    if (yInversed) {
      ord += "n";
    } else {
      ord += "s";
    }
    if (xInversed) {
      ord += "w";
    } else {
      ord += "e";
    }
    this.getOffset()
    // crossOver Check
    // calculate H/W
    console.log(evData.offset)
    this.evData = {
      ...this.evData,
      startHeight : Math.abs(yDif),
      startWidth : Math.abs(xDif),
      xDif: Math.abs(xDif) - startWidth,
      yDif: Math.abs(xDif) - startHeight,
      ord,
      xInversed,
      yInversed,
    }
    // const {{ zoomRect } = this.state;
    // const { x: x1, y: y1 } = p1;
    // const { x: x2, y: y2 } = p2;
    // const xCrd = x1-x2 > 0 ? x2 : x1, yCrd = y1-y2 > 0 ? y1 : y2; // left, top
    // const width = Math.abs(x1-x2), height = Math.abs(y1-y2);
    // // Calculate ZoomDrawFactor !!!
    // const nextRect = {
    //   pos: {
    //     x: x1,
    //     y: y1
    //   },
    //   width,
    //   height
    // }
    // console.log("prevRect : ", zoomRect);
    // console.log("nextRect : ",nextRect);
    // console.log("position : ", p2);
    // this.setState({
    //   zoomRect : nextRect,
    //   prevRect : zoomRect
    // })
    // }
  }
  public refreshCanvas() {
    const ctx = this.canv.current!.getContext("2d");
    const canvas = ctx!.canvas;
    canvas.height = document.documentElement.clientHeight * 0.7;
    canvas.width = document.documentElement.clientWidth * 0.7;
    var img = new Image();
    img.src =
      this.props.src;
    img.onload = function() {
      let final_width, final_height;
      if (canvas.height * (img.width / img.height) < canvas.width) {
        final_width = canvas.height * (img.width / img.height);
        final_height = canvas.height;
      } else {
        final_width = canvas.width;
        final_height = canvas.width * (img.height / img.width);
      }
      ctx!.drawImage(
        img,
        0,
        0,
        img.width,
        img.height,
        0,
        0,
        final_width,
        final_height
      );
    }
  }
  public onDrawBoxEnd() {
    this.setState({
      drawIsActive : false
    })
    this.drawStarted = false;
    this.mouseDownOnCrop = false;
    //Zoom
    //Set isRect True
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
        else {
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
    }
  }

  public handleTouchEnd(syntheticEvent: React.SyntheticEvent) {
    const { moveMode } = this.props
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
            drawCanvas = {this.drawCanvas}
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
