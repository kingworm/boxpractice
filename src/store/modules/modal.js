import * as types from "./ActionTypes";

const initialState = {
  commonOpen: () => {},
  explainOpen: () => {},
  title: "Welcome!",
  content: "Thank you for using our service."
};

export default function modal(state = initialState, action) {
  switch (action.type) {
    case types.SET_COMMON_MODAL_OPEN_FUNC:
      return { ...state, commonOpen: action.func };
    case types.SET_EXPLAIN_MODAL_OPEN_FUNC:
      return { ...state, explainOpen: action.func };
    default:
      return state;
  }
}
