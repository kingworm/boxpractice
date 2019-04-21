import React from "react";
import CustomPinchToZoom from "./CustomPinchToZoom";
import BoxCanvas from "./BoxCanvas";

class BoxView extends React.Component {
  constructor(props) {
    super(props);
    this._canvas = React.createRef(HTMLCanvasElement);
    this.state = {
      // isZoomed: false,
      // isDrawing: false,
      // zoomedRect: {}
      moveMode : false,
      img : "http://tenasia.hankyung.com/webwp_kr/wp-content/uploads/2017/11/2017111918415020973-768x1152.jpg"
    };
  }
  // handleDragStart = e => {
  //   // let zoom = this._child.current.zoomIn(3);
  //   // console.log(this.state.zoomedRect);
  //   if (this.state.isZoomed) {
  //     return;
  //   }
  //   if (this.state.isDrawing) {
  //     return;
  //   }
  //   const zoomedRect = {
  //     x: e.nativeEvent.offsetX,
  //     y: e.nativeEvent.offsetY,
  //     width: 0,
  //     height: 0
  //   };
  //   this.setState({
  //     isDrawing: true,
  //     zoomedRect
  //   });
  //   // var canvas = document.createElement("canvas");
  //   // if (canvas.getContext) {
  //   //   var ctx = canvas.getContext("2d");
  //   //   ctx.strokeRect(
  //   //     zoomedRect.x,
  //   //     zoomedRect.y,
  //   //     zoomedRect.width,
  //   //     zoomedRect.height
  //   //   );

  //   // }
  // };
  // handleDragEnd = e => {
  //   if (this.state.isZoomed) {
  //     alert("Already zoomed");
  //     return;
  //   } else {
  //     // console.log(e.nativeEvent.offsetX);
  //     // console.log(e.nativeEvent.offsetY);
  //     // this.setState({
  //     //   isDrawing: false,
  //     //   isZoomed: true
  //     // });
  //     const mouseX = e.nativeEvent.offsetX;
  //     const mouseY = e.nativeEvent.offsetY;

  //     // update the current rectangle's width and height based on the mouse position
  //     if (this.state.isDrawing) {
  //       // get the current shape (the last shape in this.state.shapes)
  //       const currShape = this.state.zoomedRect;
  //       const newWidth = mouseX - currShape.x;
  //       const newHeight = mouseY - currShape.y;
  //       const newShape = {
  //         x: currShape.x, // keep starting position the same
  //         y: currShape.y,
  //         width: newWidth, // new width and height
  //         height: newHeight
  //       };
  //       this._child.current.zoomToZone(
  //         newShape.x,
  //         newShape.y,
  //         newShape.width * 2,
  //         newShape.height * 2
  //       );
  //       this.setState({
  //         zoomedRect: newShape,
  //         isDrawing: false,
  //         isZoomed: true
  //       });
  //     }
  //     // var canvas = document.getElementsByTagName("canvas");
  //     // if (canvas.getContext) {
  //     //   var ctx = canvas.getContext("2d");
  //     //   let zoomedRect = this.state.zoomedRect;
  //     //   ctx.strokeRect(
  //     //     zoomedRect.x,
  //     //     zoomedRect.y,
  //     //     zoomedRect.width,
  //     //     zoomedRect.height
  //     //   );
  //     //   this.setState({
  //     //     isDrawing: false,
  //     //     isZoomed: true
  //     //   });
  //     // } else {
  //     //   // console.log("Cannot get Canvas Context.");
  //     // }
  //   }
  // };
  // handleMouseMove = e => {
  //   // // console.log(this.state);
  //   if (this.state.isZoomed) {
  //     return;
  //   } else {
  //     // console.log("onMouseMove");
  //     const mouseX = e.nativeEvent.offsetX;
  //     const mouseY = e.nativeEvent.offsetY;

  //     // update the current rectangle's width and height based on the mouse position
  //     if (this.state.isDrawing) {
  //       // get the current shape (the last shape in this.state.shapes)
  //       const currShape = this.state.zoomedRect;
  //       const newWidth = mouseX - currShape.x;
  //       const newHeight = mouseY - currShape.y;
  //       const newShape = {
  //         x: currShape.x, // keep starting position the same
  //         y: currShape.y,
  //         width: newWidth, // new width and height
  //         height: newHeight
  //       };

  //       this.setState({
  //         zoomedRect: newShape
  //       });
  //     }
  //   }
  // };
  // handleReset = e => {
  //   // this._child.current.reset();
  //   this.setState({
  //     isZoomed: false,
  //     zoomedRect: {}
  //   });
  // };
  // handleChange = crop => {
  //   this.setState({
  //     crop
  //   });
  // };
  render() {
    return (
      <React.Fragment>
        {/* <button onClick={this.handleReset}>reset</button> */}
        <div className="containor">
          <CustomPinchToZoom
            moveMode={this.state.moveMode}
            canvRef={this._canvas}
            src = {this.state.img}
            // ref={this._child}
          >
            {/* {(canvRef) => {
              return (
                <BoxCanvas
                  canvRef={canvRef}
                  style={{ position: "relative" }}

                />
              );
            }} */}
          </CustomPinchToZoom>
        </div>
      </React.Fragment>
    );
  }
}

BoxView.defaultProps = {
  // moveMode : true,
  // isBox : false,
}


BoxView.propTypes = {
  // moveMode : PropTypes.bool,
  // isBox : PropTypes.bool

};

export default BoxView;
