import React from "react";

class BoxCanvas extends React.Component {
  lastScale = -1;
  updateCanvas() {
    if (!this.refs.imgCanvas) return;
    const ctx = this.refs.imgCanvas.getContext("2d");
    const canvas = ctx.canvas;

    // set canvas size
    canvas.height = document.documentElement.clientHeight * 0.7;
    canvas.width = document.documentElement.clientWidth * 0.9;

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
      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.moveTo(20, 20);
      ctx.lineTo(20, 100);
      ctx.lineTo(70, 100);
      ctx.stroke();
    };
  }
  updateScale() {
    const ctx = this.refs.imgCanvas.getContext("2d");
    ctx.beginPath();
    ctx.lineWidth = 1 / this.props.scale;
    console.log(ctx.lineWidth);
    ctx.moveTo(20, 20);
    ctx.lineTo(20, 100);
    ctx.lineTo(70, 100);
    ctx.stroke();
  }
  componentDidMount() {
    this.updateCanvas();
  }
  componentDidUpdate() {
    // this.updateCanvas();
  }
  componentWillReceiveProps() {
    console.log(this.props.scale);
    // this.updateScale();
  }
  render() {
    return <canvas ref="imgCanvas" />;
  }
}

export default BoxCanvas;
