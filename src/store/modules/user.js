import * as types from "./ActionTypes";

export default function task(state = false, action) {
  switch (action.type) {
    case types.SET_USER:
      return action.user;
    default:
      return state;
  }
}
