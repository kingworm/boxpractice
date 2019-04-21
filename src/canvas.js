import React from "react";
// import Konva from "konva";
import { Stage, Layer, Rect } from "react-konva";


class Rectangle extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      color: "green"
    };
  }

  render() {
    return (
      <Rect
        x={this.props.x}
        y={this.props.y}
        width={this.props.width}
        height={this.props.height}
        strokeWidth={1}
        stroke={"lime"}
      />
    );
  }
}

class CanvasMain extends React.Component {
  state = {
    scale: 1,
    isZoomed: false,
    isDrawing: false,
    zoomedRect: {}
  };

  handleDragStart = e => {
    if (this.state.isZoomed) {
      return;
    }
    if (this.state.isDrawing) {
      return;
    }
    const zoomedRect = {
      x: e.evt.layerX,
      y: e.evt.layerY,
      width: 0,
      height: 0
    };
    this.setState({
      isDrawing: true,
      zoomedRect
    });
  };
  handleDragEnd = e => {
    if (this.state.isZoomed || !this.state.isDrawing) {
      console.log("Already zoomed");
      return;
    } else {
      this.setState({
        isDrawing: false,
        isZoomed: true
      });
    }
  };
  handleMouseMove = e => {
    if (this.state.isZoomed) {
      return;
    }
    const mouseX = e.evt.layerX;
    const mouseY = e.evt.layerY;

    // update the current rectangle's width and height based on the mouse position
    if (this.state.isDrawing) {
      // get the current shape (the last shape in this.state.shapes)
      const currShape = this.state.zoomedRect;
      const newWidth = mouseX - currShape.x;
      const newHeight = mouseY - currShape.y;
      const newShape = {
        x: currShape.x, // keep starting position the same
        y: currShape.y,
        width: newWidth, // new width and height
        height: newHeight
      };

      this.setState({
        zoomedRect: newShape
      });
    }
  };
  handleReset = () => {
    this.setState({
      isZoomed: false,
      zoomedRect: {}
    });
  };
  render() {
    const { scale } = this.state;
    return (
      <>
        <button onClick={this.handleReset}>reset</button>

        <Stage
          width={window.innerWidth}
          height={window.innerHeight}
          onMouseDown={this.handleDragStart}
          onMouseUp={this.handleDragEnd}
          onContentMouseMove={this.handleMouseMove}
          style={{
            backgroundImage:
              "url(http://tenasia.hankyung.com/webwp_kr/wp-content/uploads/2017/11/2017111918415020973-768x1152.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center"
          }}
        >
          <Layer ref="layer">
            <Rectangle
              x={this.state.zoomedRect.x}
              y={this.state.zoomedRect.y}
              width={this.state.zoomedRect.width}
              height={this.state.zoomedRect.height}
            />
          </Layer>
        </Stage>
      </>
    );
  }
}

export default CanvasMain;
