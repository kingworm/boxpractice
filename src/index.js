import React, { useState } from "react";
import ReactDOM from "react-dom";
import { Router } from "@reach/router";
import BoxView from "./boxview";
import ThemeContext from "./ThemeContext";

const App = () => {
  const theme = useState("darkblue");
  return (
    <ThemeContext.Provider value={theme}>
      <div>
        {/* <header>
          <Link to="/">Box Labeling Task</Link>
        </header> */}
        <Router>
          <BoxView path="/" />
        </Router>
      </div>
    </ThemeContext.Provider>
  );
};

ReactDOM.render(
  <App />,
  document.getElementById("root"),
  document.addEventListener(
    "touchmove",
    function(e) {
      if (
        e.touches.length >= 1
        // (e.touches.length > 1 || e.targetTouches.length > 1) &&
        // e.changedTouches.length >= 1
      )
        e.preventDefault();
    },
    { passive: false }
  )
);
