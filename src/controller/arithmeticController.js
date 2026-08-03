import { operate } from '../model/arithmetic.js';

export function createArithmeticController(view) {
  let lastSteps = null;
  let lastResult = null;

  function handleCalculate() {
    const { operandA, operandB, operation } = view.readInput();
    const outcome = operate(operandA, operandB, operation);

    if (!outcome.ok) {
      lastSteps = null;
      lastResult = null;
      view.showError(outcome.error);
      return;
    }

    lastSteps = outcome.steps;
    lastResult = outcome.result;
    view.showResult(outcome.steps, outcome.result, view.readFormats());
  }

  function handleClear() {
    lastSteps = null;
    lastResult = null;
    view.clearOutputs();
  }

  function handleFormatChange() {
    if (!lastResult || !lastSteps) return;
    view.showResult(lastSteps, lastResult, view.readFormats());
  }

  return {
    init() {
      view.bind({
        onCalculate: handleCalculate,
        onClear: handleClear,
        onFormatChange: handleFormatChange,
      });
    },
  };
}