import React, { useState } from "react";
import ReactDOM from "react-dom";
import { Router, Link } from "@reach/router";
import CanvasMain from "./canvas";
import ThemeContext from "./ThemeContext";
import BoxView from "./boxview";

const App = () => {
  const theme = useState("darkblue");
  return (
    <ThemeContext.Provider value={theme}>
      <div>
        {/* <header>
          <Link to="/">Box Labeling Task</Link>
        </header> */}
        <Router>
          {/* <CanvasMain path="/" /> */}
          <BoxView path="/" />
        </Router>
      </div>
    </ThemeContext.Provider>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));
