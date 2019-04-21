import React, { PureComponent } from "react";
// import PropTypes from "prop-types";

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
    if (!this.props.canvRef) return;
    const ctx = this.props.canvRef.current.getContext("2d");
    const canvas = ctx.canvas;

    // set canvas size
    canvas.height = document.documentElement.clientHeight * 0.7;
    canvas.width = document.documentElement.clientWidth * 0.7;

    var img = new Image();
    img.src =
      this.props.url;
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
    };
  }
  constructor(props) {
    super(props)
  }
  updateScale() {
  }
  componentDidMount() {
    const options = passiveSupported ? { passive: false } : false;
    // this.imageRef = this.refs.canvas;
    const canvas = this.props.canvRef.current;
    const ctx = canvas.getContext("2d");
    this.updateCanvas();
  }
  componentWillUnmount() {
  }

  componentDidUpdate() {
    // this.updateCanvas();
  }
  componentWillReceiveProps() {
    // console.log(this.props.scale);
    // this.updateScale();
  }

  onDocMouseTouchMove (e) {
    // const pos = getClientPos(e);
    // console.log(pos)

  };

  render() {
    const {canvRef} = this.props
    return (
        <canvas
          ref={canvRef}
          // onTouchStart={this.onComponentMouseTouchDown}
          // onMouseDown={this.onComponentMouseTouchDown}
        />
    );
  }
}

export default BoxCanvas;
