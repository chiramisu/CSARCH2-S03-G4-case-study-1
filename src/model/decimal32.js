/*
  MODEL - IEEE 754 decimal32 (decimal 32 bit floating point, DPD flavor)

  this is the brain of part 1, it takes whatever the user typed and turns it
  into the 32 bits, it never touches the DOM, if you find yourself writing
  document.getElementById in here you are in the wrong file, that goes in
  view.js and the controller is the one that connects the two

  layout of the 32 bits, this is the thing the whole project is about

    [ 1 sign ][ 5 combination ][ 6 exponent continuation ][ 20 coefficient ]

  the weird part compared to binary floating point (machine 2 and 3) is that
  the exponent and the first digit are MIXED TOGETHER inside the 5 combination
  bits, they did that so they could steal the extra bits, so you cannot just
  slice the exponent out in one go you have to look at the combination field
  first and figure out which case you are in

  numbers we care about, all of these come from the standard:
    precision            7 digits
    exponent bias        101
    stored exponent q    -101 up to 90  (so biased is 0 up to 191)
    value               (-1)^sign * coefficient * 10^q

  note the coefficient is a whole 7 digit integer NOT a 1.xxxx thing, there is
  no hidden bit and no normalization here, so 420 can be stored as 420 * 10^0
  or as 4200 * 10^-1 and both are legal and they are different bit patterns
  even though they are the same value, thats called cohorts, we always keep
  whatever the user typed so 4.20 stays 420 * 10^-2 instead of getting squashed
*/

import { encodeDecletFromString, decodeDeclet } from './dpd.js';

export const PRECISION = 7;      // how many decimal digits fit
export const BIAS = 101;         // what we add to q before storing it
export const Q_MIN = -101;       // smallest legal stored exponent
export const Q_MAX = 90;         // biggest legal stored exponent, 90 = 191 - 101


// small helpers


function toBits(value, width) {
  return value.toString(2).padStart(width, '0');
}

export function bitsToHex(bits) {
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16).toUpperCase();
  }
  return hex;
}

export function hexToBits(hex) {
  return hex
    .split('')
    .map((ch) => parseInt(ch, 16).toString(2).padStart(4, '0'))
    .join('');
}

/*
  builds a readable string of the value, this follows the same rule the standard
  uses for printing decimals, if the exponent is not positive and the adjusted
  exponent is not smaller than -6 we write it out plainly like 0.00042 otherwise
  we go scientific like 4.2E+58, we do it with strings the whole way cause
  javascript Number would wreck the precision on stuff like 9999999E+56
*/
export function toNumberString(sign, coefficient, q) {
  const s = sign ? '-' : '';
  let d = coefficient.replace(/^0+/, '');
  if (d === '') d = '0';

  const adjusted = q + d.length - 1;

  if (q <= 0 && adjusted >= -6) {
    if (q === 0) return s + d;
    if (d.length > -q) {
      return s + d.slice(0, d.length + q) + '.' + d.slice(d.length + q);
    }
    return s + '0.' + '0'.repeat(-q - d.length) + d;
  }

  let mantissa = d[0];
  if (d.length > 1) mantissa += '.' + d.slice(1);
  return s + mantissa + 'E' + (adjusted >= 0 ? '+' : '') + adjusted;
}

// ---------------------------------------------------------------------------
// parsing what the user typed
// ---------------------------------------------------------------------------

const SPECIAL_WORDS = {
  inf: 'infinity',
  infinity: 'infinity',
  nan: 'nan',
  qnan: 'nan',
  snan: 'snan',
};

/*
  takes one plain decimal string like "-420.5" and rips it into a sign, a string
  of digits and an exponent, we keep the digits as a STRING on purpose, the
  moment you do parseFloat you already lost, 7 digits is fine for a js number
  but the user can paste 20 digits and we still have to report a proper error
  instead of silently rounding behind their back
*/
function parseDecimalString(raw) {
  const text = raw.trim();
  if (text === '') return { ok: false, error: 'Type a number first.' };

  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match) {
    return {
      ok: false,
      error: `"${raw}" is not a plain decimal number. Use digits, one optional dot and an optional sign.`,
    };
  }

  const sign = match[1] === '-' ? 1 : 0;
  const intPart = match[2] || '';
  const fracPart = match[3] || '';

  if (intPart === '' && fracPart === '') {
    return { ok: false, error: `"${raw}" has no digits in it.` };
  }

  // "12.34" becomes the digits 1234 with an exponent of -2, thats all a decimal
  // point ever means, it just says how far to shift the whole thing right
  return { ok: true, sign, digits: intPart + fracPart, q: -fracPart.length };
}

/**
 * @param {object} input
 * @param {'plain'|'scaled'} input.mode  plain = just a number, scaled = number x 10^exp
 * @param {string} input.plain           used when mode is plain
 * @param {string} input.significand     used when mode is scaled
 * @param {string} input.exponent        used when mode is scaled, base 10 exponent
 */
export function parseInput(input) {
  const mode = input.mode === 'scaled' ? 'scaled' : 'plain';
  const primary = (mode === 'plain' ? input.plain : input.significand) || '';

  // special values first, the spec asks for them and they dont go through the
  // normal digit path at all, we let the user type inf / -inf / nan / snan
  const cleaned = primary.trim().toLowerCase();
  const withoutSign = cleaned.replace(/^[+-]/, '');
  if (SPECIAL_WORDS[withoutSign]) {
    return {
      ok: true,
      special: SPECIAL_WORDS[withoutSign],
      sign: cleaned.startsWith('-') ? 1 : 0,
      digits: '0000000',
      q: 0,
    };
  }

  const parsed = parseDecimalString(primary);
  if (!parsed.ok) return parsed;

  let q = parsed.q;

  if (mode === 'scaled') {
    const expText = (input.exponent || '').trim();
    if (expText === '') {
      return { ok: false, error: 'Type an exponent, or switch back to plain decimal.' };
    }
    if (!/^[+-]?\d+$/.test(expText)) {
      return { ok: false, error: `"${expText}" is not a whole number exponent.` };
    }
    const extra = Number(expText);
    if (!Number.isSafeInteger(extra) || Math.abs(extra) > 100000) {
      return { ok: false, error: 'That exponent is way outside anything decimal32 can hold.' };
    }
    // the user gave us significand x 10^extra so we just fold that exponent into
    // the one we already got from the decimal point
    q += extra;
  }

  return { ok: true, special: null, sign: parsed.sign, digits: parsed.digits, q };
}

// ---------------------------------------------------------------------------
// fitting the number into 7 digits and a legal exponent
// ---------------------------------------------------------------------------

/*
  this is where all the out of bounds checking lives, three things can go wrong
    1. too many significant digits, more than 7, we can only save it if the
       extra digits are trailing zeros cause dropping a zero and bumping the
       exponent does not change the value, otherwise we have to round and
       rounding is part 2 so for now we just say so
    2. exponent too big, we can sometimes save it by padding zeros on the right
       and lowering q (this is called clamping), if it still does not fit its
       an overflow
    3. exponent too small, same idea in reverse, drop trailing zeros and raise
       q, if it still does not fit its an underflow
*/
function fitCoefficient(sign, rawDigits, rawQ) {
  const notes = [];
  let digits = rawDigits.replace(/^0+/, '');
  if (digits === '') digits = '0';
  let q = rawQ;

  const isZero = /^0+$/.test(digits);

  // 1. squeeze down to 7 digits if the extras are only trailing zeros
  if (digits.length > PRECISION) {
    const before = digits.length;
    while (digits.length > PRECISION && digits.endsWith('0')) {
      digits = digits.slice(0, -1);
      q += 1;
    }
    if (digits.length > PRECISION) {
      return {
        ok: false,
        error:
          `That value needs ${digits.length} significant digits but decimal32 only holds ${PRECISION}. ` +
          `Rounding it would be part 2 of the machine which is not built yet, so drop some digits for now.`,
      };
    }
    notes.push(
      `Dropped ${before - digits.length} trailing zero(s) and raised the exponent, the value is the same.`
    );
  }

  if (isZero) {
    // zero has no significant digits so we are free to clamp the exponent to
    // whatever is legal, the value stays zero either way
    if (q > Q_MAX) { q = Q_MAX; notes.push('Zero, so the exponent got clamped to the top of the range.'); }
    if (q < Q_MIN) { q = Q_MIN; notes.push('Zero, so the exponent got clamped to the bottom of the range.'); }
    return { ok: true, sign, digits: digits.padStart(PRECISION, '0'), q, notes };
  }

  // 2. exponent too big, pad zeros on the right while there is still room
  if (q > Q_MAX) {
    const before = q;
    while (q > Q_MAX && digits.length < PRECISION) {
      digits += '0';
      q -= 1;
    }
    if (q > Q_MAX) {
      return {
        ok: false,
        error:
          `Overflow. The biggest decimal32 can do is 9999999E+${Q_MAX} which is about 1E+97, ` +
          `your number needs an exponent of ${before} after normalizing.`,
      };
    }
    notes.push('Padded zeros onto the coefficient so the exponent would fit, value is unchanged.');
  }

  // 3. exponent too small, drop trailing zeros while we can
  if (q < Q_MIN) {
    const before = q;
    while (q < Q_MIN && digits.length > 1 && digits.endsWith('0')) {
      digits = digits.slice(0, -1);
      q += 1;
    }
    if (q < Q_MIN) {
      return {
        ok: false,
        error:
          `Underflow. The smallest exponent decimal32 stores is ${Q_MIN}, yours came out to ${before} ` +
          `and we cannot fix it without throwing away real digits, that would need rounding which is part 2.`,
      };
    }
    notes.push('Dropped trailing zeros so the exponent would fit, value is unchanged.');
  }

  return { ok: true, sign, digits: digits.padStart(PRECISION, '0'), q, notes };
}

// ---------------------------------------------------------------------------
// the actual encoding
// ---------------------------------------------------------------------------

export function encodeSpecial(sign, special) {
  // combination field 11110 means infinity, 11111 means NaN, and for NaN the
  // very first bit of the exponent continuation is the quiet / signaling flag
  if (special === 'infinity') {
    return { sign: String(sign), combination: '11110', exponentContinuation: '000000', coefficientContinuation: '0'.repeat(20) };
  }
  return {
    sign: String(sign),
    combination: '11111',
    exponentContinuation: special === 'snan' ? '100000' : '000000',
    coefficientContinuation: '0'.repeat(20),
  };
}

export function encodeFinite(sign, coefficient, q) {
  const biased = q + BIAS;               // 0 to 191, fits in 8 bits
  const msd = Number(coefficient[0]);    // most significant digit, the one that hides in the combination field
  const e7 = (biased >> 7) & 1;
  const e6 = (biased >> 6) & 1;

  let combination;
  if (msd <= 7) {
    // small first digit, so we can fit all 3 of its bits, layout is
    // [top 2 exponent bits][3 bits of the digit]
    combination = `${e7}${e6}` + toBits(msd, 3);
  } else {
    // first digit is 8 or 9 which in binary is 100x, the 100 part is always the
    // same so we only need to keep the x, and we flag this case by starting the
    // field with 11, layout is [11][top 2 exponent bits][last bit of the digit]
    combination = '11' + `${e7}${e6}` + String(msd & 1);
  }

  const exponentContinuation = toBits(biased & 0b111111, 6);

  // the other 6 digits go out as two 10 bit declets
  const declet1 = encodeDecletFromString(coefficient.slice(1, 4));
  const declet2 = encodeDecletFromString(coefficient.slice(4, 7));

  return {
    sign: String(sign),
    combination,
    exponentContinuation,
    coefficientContinuation: declet1 + declet2,
    declets: [declet1, declet2],
    biased,
  };
}

/*
  reads 32 bits back into sign / digits / exponent, part 3 is gonna need this
  when the user pastes a hex operand, and part 1 uses it just to prove on screen
  that we can get the original number back out
*/
export function decodeBits(bits) {
  const sign = Number(bits[0]);
  const combination = bits.slice(1, 6);
  const exponentContinuation = bits.slice(6, 12);
  const coefficientContinuation = bits.slice(12, 32);

  if (combination === '11110') return { sign, special: 'infinity' };
  if (combination === '11111') {
    return { sign, special: exponentContinuation[0] === '1' ? 'snan' : 'nan' };
  }

  let msd, topTwo;
  if (combination.startsWith('11')) {
    topTwo = combination.slice(2, 4);
    msd = 8 + Number(combination[4]);
  } else {
    topTwo = combination.slice(0, 2);
    msd = parseInt(combination.slice(2, 5), 2);
  }

  const biased = parseInt(topTwo + exponentContinuation, 2);
  const digits =
    String(msd) +
    decodeDeclet(coefficientContinuation.slice(0, 10)).join('') +
    decodeDeclet(coefficientContinuation.slice(10, 20)).join('');

  return { sign, special: null, digits, q: biased - BIAS, biased };
}

// ---------------------------------------------------------------------------
// the one function the controller actually calls
// ---------------------------------------------------------------------------

/**
 * whole pipeline, user input goes in, a result object comes out, the view only
 * ever gets handed this object so if you need something new on screen add it
 * here instead of doing math inside the view
 */
export function convert(input) {
  const parsed = parseInput(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  let fields;
  let coefficient = null;
  let q = null;
  let notes = [];

  if (parsed.special) {
    fields = encodeSpecial(parsed.sign, parsed.special);
    notes.push(
      parsed.special === 'infinity'
        ? 'Infinity, the combination field is 11110 and everything after it is zero.'
        : 'NaN, the combination field is 11111 and the first exponent continuation bit says quiet or signaling.'
    );
  } else {
    const fitted = fitCoefficient(parsed.sign, parsed.digits, parsed.q);
    if (!fitted.ok) return { ok: false, error: fitted.error };
    coefficient = fitted.digits;
    q = fitted.q;
    notes = fitted.notes;
    fields = encodeFinite(fitted.sign, coefficient, q);
  }

  const bits =
    fields.sign + fields.combination + fields.exponentContinuation + fields.coefficientContinuation;

  const decoded = decodeBits(bits);

  return {
    ok: true,
    special: parsed.special,
    sign: parsed.sign,
    coefficient,
    q,
    biased: fields.biased ?? null,
    bits,
    hex: bitsToHex(bits),
    fields: {
      sign: fields.sign,
      combination: fields.combination,
      exponentContinuation: fields.exponentContinuation,
      coefficientContinuation: fields.coefficientContinuation,
      declets: fields.declets || [
        fields.coefficientContinuation.slice(0, 10),
        fields.coefficientContinuation.slice(10, 20),
      ],
    },
    value: parsed.special
      ? (parsed.sign ? '-' : '') + (parsed.special === 'infinity' ? 'Infinity' : parsed.special === 'snan' ? 'sNaN' : 'NaN')
      : toNumberString(parsed.sign, coefficient, q),
    readBack: decoded.special
      ? (decoded.sign ? '-' : '') + (decoded.special === 'infinity' ? 'Infinity' : decoded.special === 'snan' ? 'sNaN' : 'NaN')
      : toNumberString(decoded.sign, decoded.digits, decoded.q),
    notes,
  };
}
