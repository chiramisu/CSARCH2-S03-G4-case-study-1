import { groupBits, groupHex } from './view.js';

export function createArithmeticView() {
  const el = {
    opAModeRadios: document.querySelectorAll('input[name="opAMode"]'),
    opBModeRadios: document.querySelectorAll('input[name="opBMode"]'),
    operationRadios: document.querySelectorAll('input[name="operation"]'),
    opAInput: document.getElementById('opAInput'),
    opBInput: document.getElementById('opBInput'),
    calcBtn: document.getElementById('calcBtn'),
    calcClearBtn: document.getElementById('calcClearBtn'),
    calcErrorBox: document.getElementById('calcErrorBox'),
    calcBinRadios: document.querySelectorAll('input[name="calcBinFormat"]'),
    calcHexRadios: document.querySelectorAll('input[name="calcHexFormat"]'),
    resDecimal: document.getElementById('resDecimal'),
    resBinary: document.getElementById('resBinary'),
    resHex: document.getElementById('resHex'),
    calcSteps: document.getElementById('calcSteps'),
  };

  function pickedValue(radios) {
    for (const radio of radios) if (radio.checked) return radio.value;
    return null;
  }

  return {
    readInput() {
      return {
        operandA: {
          format: pickedValue(el.opAModeRadios),
          ...(pickedValue(el.opAModeRadios) === 'hex'
            ? { hex: el.opAInput.value }
            : { plain: el.opAInput.value, mode: 'plain' }),
        },
        operandB: {
          format: pickedValue(el.opBModeRadios),
          ...(pickedValue(el.opBModeRadios) === 'hex'
            ? { hex: el.opBInput.value }
            : { plain: el.opBInput.value, mode: 'plain' }),
        },
        operation: pickedValue(el.operationRadios),
      };
    },

    readFormats() {
      return {
        binary: pickedValue(el.calcBinRadios),
        hex: pickedValue(el.calcHexRadios),
      };
    },

    bind({ onCalculate, onClear, onFormatChange }) {
      el.calcBtn.addEventListener('click', onCalculate);
      el.calcClearBtn.addEventListener('click', onClear);

      for (const input of [el.opAInput, el.opBInput]) {
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') onCalculate();
        });
      }

      for (const radio of [...el.calcBinRadios, ...el.calcHexRadios]) {
        radio.addEventListener('change', onFormatChange);
      }
    },

    showError(message) {
      el.calcErrorBox.textContent = 'Error: ' + message;
      el.calcErrorBox.hidden = false;
      el.resDecimal.textContent = '-';
      el.resBinary.textContent = '-';
      el.resHex.textContent = '-';
      el.calcSteps.innerHTML = '';
    },

    clearOutputs() {
      el.calcErrorBox.hidden = true;
      el.opAInput.value = '';
      el.opBInput.value = '';
      el.resDecimal.textContent = '-';
      el.resBinary.textContent = '-';
      el.resHex.textContent = '-';
      el.calcSteps.innerHTML = '';
    },

    showResult(steps, result, formats) {
      el.calcErrorBox.hidden = true;
      el.resDecimal.textContent = result.value;
      el.resBinary.textContent = result.bits ? groupBits(result.bits, formats.binary) : '-';
      el.resHex.textContent = result.hex ? groupHex(result.hex, formats.hex) : '-';

      el.calcSteps.innerHTML = steps
        .map(
          (s) =>
            `<li><strong>${s.label}:</strong> <span>${s.detail}</span></li>`
        )
        .join('');
    },
  };
}