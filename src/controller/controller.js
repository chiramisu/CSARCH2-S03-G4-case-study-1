/*
  CONTROLLER - the middleman

  the view never talks to the model and the model never talks to the view, this
  file is the only thing that knows both of them exist, so the flow is always
  user clicks something, view tells us, we ask the model, we hand the answer to
  the view

  we hang on to the last result in lastResult so that when somebody switches
  the binary grouping from nibble to byte we can just repaint instead of
  redoing the whole conversion, its the same 32 bits either way
*/

import { convert } from '../model/decimal32.js';

export function createController(view) {
  let lastResult = null;

  function handleConvert() {
    const input = view.readInput();
    const result = convert(input);

    if (!result.ok) {
      lastResult = null;
      view.showError(result.error);
      return;
    }

    lastResult = result;
    view.showResult(result, view.readFormats());
  }

  function handleClear() {
    lastResult = null;
    view.clearOutputs();
  }

  function handleModeChange() {
    view.showInputMode(view.readInput().mode);
  }

  function handleFormatChange() {
    // nothing converted yet so there is nothing to repaint
    if (!lastResult) return;
    view.showResult(lastResult, view.readFormats());
  }

  return {
    init() {
      view.bind({
        onConvert: handleConvert,
        onClear: handleClear,
        onModeChange: handleModeChange,
        onFormatChange: handleFormatChange,
      });
      view.showInputMode(view.readInput().mode);
    },
  };

  /*
    TODO when part 2 and part 3 get built

    do NOT dump their handlers in this same controller, make a
    roundingController.js and an arithmeticController.js next to this one and
    give each one its own view file too, otherwise this file turns into a 600
    line monster and merging it on github is gonna be pain

    main.js is where you start them all up, its like 5 lines
  */
}
