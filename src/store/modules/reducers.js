import task from "./task";
import user from "./user";
import test from "./test";
import modal from "./modal";
import { combineReducers } from "redux";

const cashmissionApp = combineReducers({
  task,
  test,
  user,
  modal
});

export default cashmissionApp;
