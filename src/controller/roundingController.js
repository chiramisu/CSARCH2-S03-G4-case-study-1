import { roundAll } from '../model/rounding.js';

export function createRoundingController(view) {
  let lastOutput = null;

  function handleRound() {
    const input = view.readInput();
    const outcome = roundAll(input);

    if (!outcome.ok) {
      lastOutput = null;
      view.showError(outcome.error);
      return;
    }

    lastOutput = outcome;
    view.showResult(outcome, view.readFormats());
  }

  function handleClear() {
    lastOutput = null;
    view.clearOutputs();
  }

  function handleFormatModeChange() {
    view.showInputMode(view.readInput().format);
  }

  function handleBinarySubModeChange() {
    const input = view.readInput();
    view.showBinarySubMode(input.hex !== undefined ? 'hex' : 'bits');
  }

  function handleFormatChange() {
    if (!lastOutput) return;
    view.showResult(lastOutput, view.readFormats());
  }

  return {
    init() {
      view.bind({
        onRound: handleRound,
        onClear: handleClear,
        onFormatModeChange: handleFormatModeChange,
        onBinarySubModeChange: handleBinarySubModeChange,
        onFormatChange: handleFormatChange,
      });
      view.showInputMode(view.readInput().format);
      view.showBinarySubMode('bits');
    },
  };
}