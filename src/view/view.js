/*
  VIEW - the only file allowed to touch the DOM

  it does two things, it reads whatever the user typed and hands it over as a
  plain object, and it takes a result object and paints it on the screen, it
  does zero math, if you catch yourself importing decimal32.js in here stop,
  the controller is supposed to be the middleman

  the grouping functions at the top are view stuff on purpose, the model gives
  us one flat 32 character string and one flat 8 character hex string and then
  we decide how to chop it up for reading, that way if the team wants a fourth
  grouping option later nobody has to touch the model
*/

const FIELD_WIDTHS = [1, 5, 6, 20]; // sign, combination, exponent continuation, coefficient

/**
 * chops the 32 bits into groups for reading
 * @param {string} bits 32 characters
 * @param {'fields'|'nibble'|'byte'} mode
 */
export function groupBits(bits, mode) {
  if (!bits) return '-';

  if (mode === 'fields') {
    const parts = [];
    let at = 0;
    for (const width of FIELD_WIDTHS) {
      parts.push(bits.slice(at, at + width));
      at += width;
    }
    return parts.join(' ');
  }

  const size = mode === 'byte' ? 8 : 4;
  const parts = [];
  for (let i = 0; i < bits.length; i += size) parts.push(bits.slice(i, i + size));
  return parts.join(' ');
}

/**
 * chops the hex string, "plain" is one long string, "2" is byte sized chunks,
 * "4" is halfword sized chunks
 * @param {string} hex 8 characters
 * @param {'plain'|'2'|'4'} mode
 */
export function groupHex(hex, mode) {
  if (!hex) return '-';
  if (mode === 'plain') return hex;

  const size = Number(mode);
  const parts = [];
  for (let i = 0; i < hex.length; i += size) parts.push(hex.slice(i, i + size));
  return parts.join(' ');
}

export function createView() {
  const el = {
    modeRadios: document.querySelectorAll('input[name="inputMode"]'),
    plainFields: document.getElementById('plainFields'),
    scaledFields: document.getElementById('scaledFields'),
    plainInput: document.getElementById('plainInput'),
    significandInput: document.getElementById('significandInput'),
    exponentInput: document.getElementById('exponentInput'),
    convertBtn: document.getElementById('convertBtn'),
    clearBtn: document.getElementById('clearBtn'),
    errorBox: document.getElementById('errorBox'),
    noteBox: document.getElementById('noteBox'),
    binaryOut: document.getElementById('binaryOut'),
    binaryLegend: document.getElementById('binaryLegend'),
    hexOut: document.getElementById('hexOut'),
    breakdown: document.querySelector('#breakdown tbody'),
    binRadios: document.querySelectorAll('input[name="binFormat"]'),
    hexRadios: document.querySelectorAll('input[name="hexFormat"]'),
  };

  function pickedValue(radios) {
    for (const radio of radios) if (radio.checked) return radio.value;
    return null;
  }

  return {
    /** grabs everything the user typed, the controller passes this to the model */
    readInput() {
      return {
        mode: pickedValue(el.modeRadios),
        plain: el.plainInput.value,
        significand: el.significandInput.value,
        exponent: el.exponentInput.value,
      };
    },

    readFormats() {
      return {
        binary: pickedValue(el.binRadios),
        hex: pickedValue(el.hexRadios),
      };
    },

    /** the controller hands us callbacks, we just wire them to the events */
    bind({ onConvert, onClear, onModeChange, onFormatChange }) {
      el.convertBtn.addEventListener('click', onConvert);
      el.clearBtn.addEventListener('click', onClear);

      // pressing enter in any input should convert too, nobody wants to reach
      // for the mouse every single time when we are demoing 20 test cases
      for (const input of [el.plainInput, el.significandInput, el.exponentInput]) {
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') onConvert();
        });
      }

      for (const radio of el.modeRadios) radio.addEventListener('change', onModeChange);
      for (const radio of [...el.binRadios, ...el.hexRadios]) {
        radio.addEventListener('change', onFormatChange);
      }
    },

    showInputMode(mode) {
      el.plainFields.hidden = mode !== 'plain';
      el.scaledFields.hidden = mode !== 'scaled';
    },

    showError(message) {
      el.errorBox.textContent = 'Error: ' + message;
      el.errorBox.hidden = false;
      el.noteBox.hidden = true;
      el.binaryOut.textContent = '-';
      el.binaryLegend.textContent = '';
      el.hexOut.textContent = '-';
      el.breakdown.innerHTML = '';
    },

    clearOutputs() {
      el.errorBox.hidden = true;
      el.noteBox.hidden = true;
      el.binaryOut.textContent = '-';
      el.binaryLegend.textContent = '';
      el.hexOut.textContent = '-';
      el.breakdown.innerHTML = '';
      el.plainInput.value = '';
      el.significandInput.value = '';
      el.exponentInput.value = '';
    },

    /** paints a successful conversion, formats says how to chop the strings up */
    showResult(result, formats) {
      el.errorBox.hidden = true;

      if (result.notes && result.notes.length) {
        el.noteBox.textContent = 'Note: ' + result.notes.join(' ');
        el.noteBox.hidden = false;
      } else {
        el.noteBox.hidden = true;
      }

      el.binaryOut.textContent = groupBits(result.bits, formats.binary);
      el.binaryLegend.textContent =
        formats.binary === 'fields'
          ? '1 sign bit, 5 combination bits, 6 exponent continuation bits, 20 densely packed BCD bits'
          : '';

      el.hexOut.textContent = groupHex(result.hex, formats.hex);

      const rows = [
        ['Value being stored', result.value],
        ['Sign bit', `${result.fields.sign} (${result.sign ? 'negative' : 'positive'})`],
        ['Combination field', result.fields.combination],
        ['Exponent continuation', result.fields.exponentContinuation],
        ['Coefficient continuation (DPD)', result.fields.coefficientContinuation],
      ];

      if (!result.special) {
        rows.push(
          ['Coefficient digits', `${result.coefficient} (first digit is inside the combination field)`],
          ['Declet 1', `${result.fields.declets[0]} = digits ${result.coefficient.slice(1, 4)}`],
          ['Declet 2', `${result.fields.declets[1]} = digits ${result.coefficient.slice(4, 7)}`],
          ['Exponent, unbiased', String(result.q)],
          ['Exponent, biased (q + 101)', `${result.biased} = ${result.biased.toString(2).padStart(8, '0')}`]
        );
      } else {
        rows.push(['Special value', result.value]);
      }

      rows.push(['Decoded back from the bits', result.readBack]);

      el.breakdown.innerHTML = rows
        .map(([label, value]) => `<tr><td>${label}</td><td class="out">${value}</td></tr>`)
        .join('');
    },
  };
}
