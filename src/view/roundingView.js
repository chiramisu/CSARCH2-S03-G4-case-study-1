import { groupBits, groupHex } from './view.js';

const METHOD_LABELS = {
  chop: 'Chopping (truncate)',
  up: 'Round up (toward +\u221e)',
  down: 'Round down (toward -\u221e)',
  tiesToEven: 'Round to nearest, ties to even',
};

export function createRoundingView() {
  const el = {
    formatRadios: document.querySelectorAll('input[name="roundFormat"]'),
    decimalFields: document.getElementById('roundDecimalFields'),
    decimalInput: document.getElementById('roundDecimalInput'),
    binaryFields: document.getElementById('roundBinaryFields'),
    binarySubRadios: document.querySelectorAll('input[name="roundBinarySubFormat"]'),
    bitsFields: document.getElementById('roundBitsFields'),
    bitsInput: document.getElementById('roundBitsInput'),
    hexFields: document.getElementById('roundHexFields'),
    hexInput: document.getElementById('roundHexInput'),
    keepInput: document.getElementById('roundKeepInput'),
    roundBtn: document.getElementById('roundBtn'),
    roundClearBtn: document.getElementById('roundClearBtn'),
    roundErrorBox: document.getElementById('roundErrorBox'),
    roundNoteBox: document.getElementById('roundNoteBox'),
    roundBinRadios: document.querySelectorAll('input[name="roundBinFormat"]'),
    roundHexRadios: document.querySelectorAll('input[name="roundHexFormat"]'),
    roundResultBody: document.querySelector('#roundResultTable tbody'),
  };

  function pickedValue(radios) {
    for (const radio of radios) if (radio.checked) return radio.value;
    return null;
  }

  return {
    readInput() {
      const format = pickedValue(el.formatRadios);
      const keepRaw = el.keepInput.value.trim();
      const keep = keepRaw === '' ? undefined : Number(keepRaw);

      if (format === 'binary') {
        const subFormat = pickedValue(el.binarySubRadios);
        if (subFormat === 'hex') {
          return { format: 'binary', hex: el.hexInput.value.trim(), keep };
        }
        return { format: 'binary', bits: el.bitsInput.value.trim(), keep };
      }

      return { format: 'decimal', mode: 'plain', plain: el.decimalInput.value, keep };
    },

    readFormats() {
      return {
        binary: pickedValue(el.roundBinRadios),
        hex: pickedValue(el.roundHexRadios),
      };
    },

    bind({ onRound, onClear, onFormatModeChange, onBinarySubModeChange, onFormatChange }) {
      el.roundBtn.addEventListener('click', onRound);
      el.roundClearBtn.addEventListener('click', onClear);

      for (const input of [el.decimalInput, el.bitsInput, el.hexInput, el.keepInput]) {
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') onRound();
        });
      }

      for (const radio of el.formatRadios) radio.addEventListener('change', onFormatModeChange);
      for (const radio of el.binarySubRadios) radio.addEventListener('change', onBinarySubModeChange);
      for (const radio of [...el.roundBinRadios, ...el.roundHexRadios]) {
        radio.addEventListener('change', onFormatChange);
      }
    },

    /** toggles decimal input vs binary input **/
    showInputMode(format) {
      el.decimalFields.hidden = format !== 'decimal';
      el.binaryFields.hidden = format !== 'binary';
    },

    /** toggles between the raw-bits box and the hex box inside binary mode */
    showBinarySubMode(subFormat) {
      el.bitsFields.hidden = subFormat !== 'bits';
      el.hexFields.hidden = subFormat !== 'hex';
    },

    showError(message) {
      el.roundErrorBox.textContent = 'Error: ' + message;
      el.roundErrorBox.hidden = false;
      el.roundNoteBox.hidden = true;
      el.roundResultBody.innerHTML = '';
    },

    clearOutputs() {
      el.roundErrorBox.hidden = true;
      el.roundNoteBox.hidden = true;
      el.decimalInput.value = '';
      el.bitsInput.value = '';
      el.hexInput.value = '';
      el.keepInput.value = '';
      el.roundResultBody.innerHTML = '';
    },

    /** paints the four-method table **/
    showResult(output, formats) {
      el.roundErrorBox.hidden = true;

      el.roundNoteBox.textContent = output.special
        ? `Special value (${output.results.chop.special}), rounding doesn't change it, all four methods pass it through unchanged.`
        : `Parsed input: sign ${output.sign}, digits ${output.digits}, exponent ${output.q}. Rounding to ${output.keep} digit(s).`;
      el.roundNoteBox.hidden = false;

      const methods = ['chop', 'up', 'down', 'tiesToEven'];
      el.roundResultBody.innerHTML = methods
        .map((method) => {
          const r = output.results[method];
          const binary = r.bits ? groupBits(r.bits, formats.binary) : '-';
          const hex = r.hex ? groupHex(r.hex, formats.hex) : '-';
          return (
            `<tr>` +
            `<td>${METHOD_LABELS[method]}</td>` +
            `<td class="out">${r.value}</td>` +
            `<td><pre class="out">${binary}</pre></td>` +
            `<td><pre class="out">${hex}</pre></td>` +
            `</tr>`
          );
        })
        .join('');
    },
  };
}