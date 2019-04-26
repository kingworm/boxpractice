import React from "react";
import CustomPinchToZoom from "./CustomPinchToZoom";

class BoxView extends React.Component {
  constructor(props) {
    super(props);
    this._canvas = React.createRef(HTMLCanvasElement);
    this._child = React.createRef();
    this.state = {
      moveMode : false,
      img : "http://tenasia.hankyung.com/webwp_kr/wp-content/uploads/2017/11/2017111918415020973-768x1152.jpg"
    };
  }
  reset = () => {
    this._child.reset();
  }
  submit = () => {
    console.log(
      this._child.getData()
    );
  }
  allSubmit = () => {

  }
  toggleMoveMode = () => {
    if(this.state.moveMode) {
      console.log("Toggled To Drawing Mode.");
    } else {
      console.log("Toggled To Moving Mode")
    }

    this.setState({
      moveMode : !this.state.moveMode
    })
    
  }

  render() {
    return (
      <React.Fragment>
        {/* <button onClick={this.handleReset}>reset</button> */}
        <div className="containor">
          <CustomPinchToZoom
            moveMode={this.state.moveMode}
            canvRef={this._canvas}
            ref = {(ref) => this._child = ref}
            src = {this.state.img}
          >
          </CustomPinchToZoom>
        </div>
        <button onClick={this.reset.bind(this)}>reset?</button>
        <button onClick={this.toggleMoveMode.bind(this)}>Move?</button>
        <button onClick={this.submit.bind(this)}>BoxSubmit!</button>
        <button onClick={this.allSubmit.bind(this)}>AllFoundSubmit!</button>

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
