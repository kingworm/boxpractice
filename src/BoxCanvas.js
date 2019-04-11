import React, { PureComponent } from "react";
import PropTypes from "prop-types";

let passiveSupported = false;

try {
  window.addEventListener(
    "test",
    null,
    Object.defineProperty({}, "passive", {
      get: () => {
        passiveSupported = true;
        return true;
      }
    })
  );
} catch (err) {} // eslint-disable-line no-empty
const EMPTY_GIF =
  "http://tenasia.hankyung.com/webwp_kr/wp-content/uploads/2017/11/2017111918415020973-768x1152.jpg";

function getClientPos(e) {
  let pageX;
  let pageY;

  if (e.touches) {
    [{ pageX, pageY }] = e.touches;
  } else {
    ({ pageX, pageY } = e);
  }

  return {
    x: pageX,
    y: pageY
  };
}

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

function isCropValid(crop) {
  return (
    crop &&
    crop.width &&
    crop.height &&
    !isNaN(crop.width) &&
    !isNaN(crop.height)
  );
}

function inverseOrd(ord) {
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

function makeAspectCrop(crop, imageAspect) {
  if (isNaN(crop.aspect) || isNaN(imageAspect)) {
    console.warn(
      "`crop.aspect` and `imageAspect` need to be numbers in order to make an aspect crop",
      crop
    );
    return crop;
  }

  const completeCrop = {
    x: 0,
    y: 0,
    ...crop
  };

  if (crop.width) {
    completeCrop.height = (crop.width / crop.aspect) * imageAspect;
  }
  if (crop.height) {
    completeCrop.width =
      (completeCrop.height || crop.height) * (crop.aspect / imageAspect);
  }

  if (crop.y + (completeCrop.height || crop.height) > 100) {
    completeCrop.height = 100 - crop.y;
    completeCrop.width = (completeCrop.height * crop.aspect) / imageAspect;
  }

  if (crop.x + (completeCrop.width || crop.width) > 100) {
    completeCrop.width = 100 - crop.x;
    completeCrop.height = (completeCrop.width / crop.aspect) * imageAspect;
  }

  return completeCrop;
}

function isAspectInvalid(crop, width, height) {
  if ((!crop.width && crop.height) || (crop.width && !crop.height)) {
    return true;
  }

  if (
    crop.width &&
    crop.height &&
    Math.round(height * (crop.height / 100) * crop.aspect) !==
      Math.round(width * (crop.width / 100))
  ) {
    return true;
  }

  return false;
}

function resolveCrop(crop, image) {
  if (
    crop &&
    crop.aspect &&
    isAspectInvalid(crop, image.naturalWidth, image.naturalHeight)
  ) {
    return makeAspectCrop(crop, image.naturalWidth / image.naturalHeight);
  }

  return crop;
}

function getPixelCrop(image, percentCrop, useNaturalImageDimensions = true) {
  if (!image || !percentCrop) {
    return null;
  }

  const imageWidth = useNaturalImageDimensions
    ? image.naturalWidth
    : image.width;
  const imageHeight = useNaturalImageDimensions
    ? image.naturalHeight
    : image.height;

  const x = Math.round(imageWidth * (percentCrop.x / 100));
  const y = Math.round(imageHeight * (percentCrop.y / 100));
  const width = Math.round(imageWidth * (percentCrop.width / 100));
  const height = Math.round(imageHeight * (percentCrop.height / 100));

  return {
    x,
    y,
    // Clamp width and height so rounding doesn't cause the crop to exceed bounds.
    width: clamp(width, 0, imageWidth - x),
    height: clamp(height, 0, imageHeight - y)
  };
}

function containCrop(prevCrop, crop, imageAspect) {
  const contained = { ...crop };

  // Fixes issue where crop can be dragged to the left when resizing with SW ord
  // even though it's hit the bottom of the image.
  if (crop.aspect && prevCrop.x > crop.x && crop.height + crop.y >= 100) {
    contained.x = prevCrop.x;
  }

  // Don't let the crop grow on the opposite side when hitting an x image boundary.
  let cropXAdjusted = false;
  if (contained.x + contained.width > 100) {
    contained.width = crop.width + (100 - (crop.x + crop.width));
    contained.x = crop.x + (100 - (crop.x + contained.width));
    cropXAdjusted = true;
  } else if (contained.x < 0) {
    contained.width = crop.x + crop.width;
    contained.x = 0;
    cropXAdjusted = true;
  }

  if (cropXAdjusted && crop.aspect) {
    // Adjust height to the resized width to maintain aspect.
    contained.height = (contained.width / crop.aspect) * imageAspect;
    // If sizing in up direction we need to pin Y at the point it
    // would be at the boundary.
    if (prevCrop.y > contained.y) {
      contained.y = crop.y + (crop.height - contained.height);
    }
  }

  // Don't let the crop grow on the opposite side when hitting a y image boundary.
  let cropYAdjusted = false;
  if (contained.y + contained.height > 100) {
    contained.height = crop.height + (100 - (crop.y + crop.height));
    contained.y = crop.y + (100 - (crop.y + contained.height));
    cropYAdjusted = true;
  } else if (contained.y < 0) {
    contained.height = crop.y + crop.height;
    contained.y = 0;
    cropYAdjusted = true;
  }

  if (cropYAdjusted && crop.aspect) {
    // Adjust width to the resized height to maintain aspect.
    contained.width = (contained.height * crop.aspect) / imageAspect;
    // If sizing in up direction we need to pin X at the point it
    // would be at the boundary.
    if (contained.x < crop.x) {
      contained.x = crop.x + (crop.width - contained.width);
    }
  }

  return contained;
}

class BoxCanvas extends PureComponent {
  window = window;

  document = document;

  state = {};

  lastScale = -1;
  updateCanvas() {
    if (!this.refs.imgCanvas) return;
    const ctx = this.refs.imgCanvas.getContext("2d");
    const canvas = ctx.canvas;

    // set canvas size
    canvas.height = document.documentElement.clientHeight * 0.7;
    canvas.width = document.documentElement.clientWidth * 0.9;

    /*
      if (this.imageRef.complete || this.imageRef.readyState) {
      if (this.imageRef.naturalWidth === 0) {
        // Broken load on iOS, PR #51
        // https://css-tricks.com/snippets/jquery/fixing-load-in-ie-for-cached-images/
        // http://stackoverflow.com/questions/821516/browser-independent-way-to-detect-when-image-has-been-loaded
        const { src } = this.imageRef;
        this.imageRef.src = EMPTY_GIF;
        this.imageRef.src = src;
      } else {
        this.onImageLoad(this.imageRef);
      }
    }
    */

    // set image to canvas
    var img = new Image();
    img.src =
      "http://tenasia.hankyung.com/webwp_kr/wp-content/uploads/2017/11/2017111918415020973-768x1152.jpg";
    img.onload = function() {
      let final_width, final_height;
      if (canvas.height * (img.width / img.height) < canvas.width) {
        final_width = canvas.height * (img.width / img.height);
        final_height = canvas.height;
      } else {
        final_width = canvas.width;
        final_height = canvas.width * (img.height / img.width);
      }
      ctx.drawImage(
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
      // ctx.beginPath();
      // ctx.lineWidth = 1;
      // ctx.moveTo(20, 20);
      // ctx.lineTo(20, 100);
      // ctx.lineTo(70, 100);
      // ctx.stroke();
      ctx.strokeRect(50, 50, 50, 50);
    };
  }
  onChange(crop) {
    const ctx = this.refs.imgCanvas.getContext("2d");
  }
  updateScale() {
    const ctx = this.refs.imgCanvas.getContext("2d");
    // ctx.beginPath();
    // ctx.lineWidth = 1 / this.props.scale;
    // console.log(ctx.lineWidth);
    // ctx.moveTo(20, 20);
    // ctx.lineTo(20, 100);
    // ctx.lineTo(70, 100);
    // ctx.stroke();
    ctx.strokeRect(50, 50, 50, 50);
  }
  componentDidMount() {
    const options = passiveSupported ? { passive: false } : false;

    this.document.addEventListener(
      "mousemove",
      this.onDocMouseTouchMove,
      options
    );
    this.document.addEventListener(
      "touchmove",
      this.onDocMouseTouchMove,
      options
    );

    this.document.addEventListener("mouseup", this.onDocMouseTouchEnd, options);
    this.document.addEventListener(
      "touchend",
      this.onDocMouseTouchEnd,
      options
    );
    this.document.addEventListener(
      "touchcancel",
      this.onDocMouseTouchEnd,
      options
    );

    this.updateCanvas();
  }
  componentWillUnmount() {
    this.document.removeEventListener("mousemove", this.onDocMouseTouchMove);
    this.document.removeEventListener("touchmove", this.onDocMouseTouchMove);

    this.document.removeEventListener("mouseup", this.onDocMouseTouchEnd);
    this.document.removeEventListener("touchend", this.onDocMouseTouchEnd);
    this.document.removeEventListener("touchcancel", this.onDocMouseTouchEnd);
  }

  componentDidUpdate() {
    // this.updateCanvas();
  }
  componentWillReceiveProps() {
    this.document.removeEventListener("mousemove", this.onDocMouseTouchMove);
    this.document.removeEventListener("touchmove", this.onDocMouseTouchMove);

    this.document.removeEventListener("mouseup", this.onDocMouseTouchEnd);
    this.document.removeEventListener("touchend", this.onDocMouseTouchEnd);
    this.document.removeEventListener("touchcancel", this.onDocMouseTouchEnd);

    console.log(this.props.scale);
    // this.updateScale();
  }
  onCropMouseTouchDown = e => {
    console.log("touchDown");
    const { crop, disabled } = this.props;

    if (disabled) {
      return;
    }

    e.preventDefault(); // Stop drag selection.

    const clientPos = getClientPos(e);

    // Focus for detecting keypress.
    this.componentRef.focus({ preventScroll: true });

    const { ord } = e.target.dataset;
    const xInversed = ord === "nw" || ord === "w" || ord === "sw";
    const yInversed = ord === "nw" || ord === "n" || ord === "ne";

    let cropOffset;

    if (crop.aspect) {
      console.log("getElementOfset");
      // cropOffset = this.getElementOffset(this.cropSelectRef);
    }

    this.evData = {
      clientStartX: clientPos.x,
      clientStartY: clientPos.y,
      cropStartWidth: crop.width,
      cropStartHeight: crop.height,
      cropStartX: xInversed ? crop.x + crop.width : crop.x,
      cropStartY: yInversed ? crop.y + crop.height : crop.y,
      xInversed,
      yInversed,
      xCrossOver: xInversed,
      yCrossOver: yInversed,
      startXCrossOver: xInversed,
      startYCrossOver: yInversed,
      isResize: e.target.dataset.ord,
      ord,
      cropOffset
    };

    this.mouseDownOnCrop = true;
    this.setState({ cropIsActive: true });
  };

  onComponentMouseTouchDown = e => {
    const {
      crop,
      disabled,
      locked,
      keepSelection,
      onChange,
      useNaturalImageDimensions
    } = this.props;
    console.log(this.imageRef);
    console.log("mousedown");
    if (e.target !== this.imageRef) {
      console.log("non_target");
      return;
    }

    if (disabled || locked || (keepSelection && isCropValid(crop))) {
      console.log("???");
      return;
    }

    e.preventDefault(); // Stop drag selection.

    const clientPos = getClientPos(e);

    // Focus for detecting keypress.
    this.componentRef.focus({ preventScroll: true });
    console.log("getElementOffset");
    // const imageOffset = this.getElementOffset(this.imageRef);
    const imageOffset = {};
    const xPc = ((clientPos.x - imageOffset.left) / this.imageRef.width) * 100;
    const yPc = ((clientPos.y - imageOffset.top) / this.imageRef.height) * 100;

    const nextCrop = {
      aspect: crop ? crop.aspect : undefined,
      x: xPc,
      y: yPc,
      width: 0,
      height: 0
    };

    this.evData = {
      clientStartX: clientPos.x,
      clientStartY: clientPos.y,
      cropStartWidth: nextCrop.width,
      cropStartHeight: nextCrop.height,
      cropStartX: nextCrop.x,
      cropStartY: nextCrop.y,
      xInversed: false,
      yInversed: false,
      xCrossOver: false,
      yCrossOver: false,
      startXCrossOver: false,
      startYCrossOver: false,
      isResize: true,
      ord: "nw"
    };

    this.mouseDownOnCrop = true;
    onChange(
      nextCrop,
      getPixelCrop(this.imageRef, nextCrop, useNaturalImageDimensions)
    );
    this.setState({ cropIsActive: true });
  };

  onDocMouseTouchMove = e => {
    // console.log("Move!!");
    const { crop, disabled, onChange, onDragStart } = this.props;

    if (disabled) {
      console.log("disabled");
      return;
    }

    if (!this.mouseDownOnCrop) {
      console.log("not_crop");
      return;
    }
    e.preventDefault(); // Stop drag selection.
    // if (!this.dragStarted) {
    //   console.log("Not_started");
    //   this.dragStarted = true;
    //   onDragStart();
    // }

    const { evData } = this;
    const clientPos = getClientPos(e);
    console.log(evData);
    if (evData.isResize && crop.aspect && evData.cropOffset) {
      clientPos.y = this.straightenYPath(clientPos.x);
    }

    const xDiffPx = clientPos.x - evData.clientStartX;
    evData.xDiffPc = (xDiffPx / this.imageRef.width) * 100;

    const yDiffPx = clientPos.y - evData.clientStartY;
    evData.yDiffPc = (yDiffPx / this.imageRef.height) * 100;

    let nextCrop;

    if (evData.isResize) {
      nextCrop = this.resizeCrop();
    } else {
      nextCrop = this.dragCrop();
    }
    console.log(nextCrop);
    if (nextCrop !== crop) {
      onChange(nextCrop, getPixelCrop(this.imageRef, nextCrop));
    }
  };

  onDocMouseTouchEnd = () => {
    console.log("END!!");
    const {
      crop,
      disabled,
      onComplete,
      onDragEnd,
      useNaturalImageDimensions
    } = this.props;

    if (disabled) {
      return;
    }

    if (this.mouseDownOnCrop) {
      this.mouseDownOnCrop = false;
      this.dragStarted = false;
      onDragEnd();
      onComplete(
        crop,
        getPixelCrop(this.imageRef, crop, useNaturalImageDimensions)
      );
      this.setState({ cropIsActive: false });
    }
  };

  render() {
    return (
      <div
        ref={ref => {
          this.componentRef = ref;
        }}
      >
        <canvas
          ref={ref => {
            this.imageRef = ref;
          }}
          onTouchStart={this.onComponentMouseTouchDown}
          onMouseDown={this.onComponentMouseTouchDown}
        />
      </div>
    );
  }
}

export default BoxCanvas;
