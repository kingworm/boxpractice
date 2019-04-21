import * as types from "./ActionTypes";

export default function task(state = false, action) {
  switch (action.type) {
    case types.SET_TASK:
      return action.task;
    case types.DEL_TASK:
      return false;
    default:
      return state;
  }
}
