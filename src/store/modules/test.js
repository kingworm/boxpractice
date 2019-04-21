import * as types from "./ActionTypes";

export default function test(state = false, action) {
  switch (action.type) {
    case types.SET_TEST:
      return action.test;
    case types.DEL_TEST:
      return false;
    default:
      return state;
  }
}
