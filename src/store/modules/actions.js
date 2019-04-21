import * as ActionTypes from "./ActionTypes";

export function setCommonModalOpenFunc(func) {
  return {
    type: ActionTypes.SET_COMMON_MODAL_OPEN_FUNC,
    func: func
  };
}

export function setExplainModalOpenFunc(func) {
  return {
    type: ActionTypes.SET_EXPLAIN_MODAL_OPEN_FUNC,
    func: func
  };
}

export function setTask(task) {
  return {
    type: ActionTypes.SET_TASK,
    task: task
  };
}
export function delTask() {
  return {
    type: ActionTypes.DEL_TASK
  };
}

export function setUser(user) {
  return {
    type: ActionTypes.SET_USER,
    user: user
  };
}

export function setTest(test) {
  return {
    type: ActionTypes.SET_TEST,
    test: test
  };
}

export function delTest() {
  return {
    type: ActionTypes.DEL_TEST
  };
}
