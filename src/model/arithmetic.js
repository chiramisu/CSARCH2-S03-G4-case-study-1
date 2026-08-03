/*
  
  MODEL - PART 3, SUBTRACTION AND DIVISION          *** NOT BUILT YET ***

  empty on purpose same as rounding.js, this is the biggest part of the whole
  project so whoever gets it start early, the step by step output is what eats
  the time not the math itself

  WHAT SIR IS ASKING FOR
    a. input, operands in either decimal or IEEE hexadecimal format
    b. input, the type of operation, subtraction or division
    c. output, the step by step solution and final result including special
       cases, in decimal, in binary with proper spacing, and in hexadecimal

  note machine 4 is the SUBTRACTION and DIVISION one, machines 2 and 3 got
  addition and multiplication, so do not accidentally build the wrong pair, and
  note it says "using rounding method" which means part 2 has to exist first,
  the result of a subtract or a divide almost never fits in 7 digits so you
  round it at the end, so part 2 and part 3 are kind of a package deal, plan
  around that when we split the work

  
  SUBTRACTION, how it goes

  1. line up the exponents, the two numbers can have different exponents like
     4.20E+2 and 1.5E+0 and you cannot subtract those digit by digit until they
     match, so shift the one with the bigger exponent left (add zeros on the
     right of its digits, lower its exponent) until both exponents are equal
     careful, shifting left can blow past 7 digits, thats fine and expected, we
     keep the extra digits during the work and only round at the very end,
     thats basically what guard digits are for
  2. now both are plain integers with the same exponent so just subtract the
     digit strings, use BigInt for this part its way less painful, or do the
     borrow by hand if you want to show the borrowing in the step by step which
     honestly might look better in the video
  3. if the answer came out negative flip the sign and keep the magnitude
  4. round the result back down to 7 digits using part 2
  5. check the exponent still fits, decimal32 only goes q from -101 to 90, if
     not thats overflow or underflow

  a subtract is just an add where you flipped the second sign so if the team
  wants to share code with anybody doing addition it is basically free

  DIVISION, how it goes

  1. exponent of the answer starts as exponent of a minus exponent of b, thats
     just the 10^x rule
  2. divide the digit strings long division style, and since it usually does
     not come out even you keep going until you have enough digits to round
     with, 7 digits plus a couple extra is plenty, do not try to go forever
     cause 1 divided by 3 never terminates
  3. adjust the exponent for however many extra places you generated while
     dividing, this is the part that gets messed up, count carefully
  4. round to 7 digits, check the range

  
  SPECIAL CASES, sir specifically said including special cases so we WILL get
  asked about these in the demo, make a test for every single line

    subtraction
      inf minus inf          = NaN
      inf minus anything     = inf
      anything minus inf     = -inf
      NaN with anything      = NaN
      x minus x              = 0, and the sign of that zero is positive in the
                               default rounding mode, negative zero is a real
                               thing here so dont crash on it
    division
      0 divided by 0         = NaN
      inf divided by inf     = NaN
      x divided by 0         = inf with the sign being the xor of the two signs
      0 divided by x         = 0
      inf divided by x       = inf
      x divided by inf       = 0
      anything with NaN      = NaN, and if one of them is a signaling NaN it is
                               supposed to raise the invalid flag, we probably
                               just show it as a message on screen

  
  THE STEP BY STEP OUTPUT

  this is the actual grade, printing the final answer alone is not enough, what
  we want on screen is roughly

    step 1  decoded operand a, sign / coefficient / exponent
    step 2  decoded operand b, sign / coefficient / exponent
    step 3  aligned the exponents, here is what both look like now
    step 4  the raw subtraction or the long division work
    step 5  the unrounded result
    step 6  rounded to 7 digits with which method and why that digit
    step 7  re encoded, and then show it in decimal, binary and hex

  so make the model return an array of step objects like
    { label: 'Align exponents', detail: '...' }
  and let the view just loop over it and print them, do not build the html
  string inside the model, keep the mvc split clean

  for the hex input case just do hexToBits then decodeBits, both are already
  exported from decimal32.js, and validate that the user typed exactly 8 hex
  characters before you trust it

  - IMPLEMENTED SUBTRACTION PART NOTES

      Subtraction: operand decoding
      (decimal AND hex), exponent alignment, signed-magnitude subtraction with
      BigInt, x - x -> +0, rounding via part 2's roundOnce (ties-to-even, the
      IEEE 754 default), and an overflow/underflow check on the final exponent.

      operate() dispatches: special cases first, then subtract if that's the
      operation. 
  
*/

import {
  parseInput,
  decodeBits,
  hexToBits,
  bitsToHex,
  toNumberString,
  encodeFinite,
  encodeSpecial,
  convert,
  PRECISION,
  Q_MIN,
  Q_MAX,
} from './decimal32.js';
import { roundOnce } from './rounding.js';

export const OPERATIONS = ['subtract', 'divide'];

// the rounding method decimal32 arithmetic defaults to, ties-to-even
const DEFAULT_ROUNDING_METHOD = 'tiesToEven';

// operand decoding 
/**
 * Turns whatever the user typed for one operand into a canonical
 * { sign, special, digits, q } shape, the same shape decodeBits/parseInput
 * already use elsewhere in the project, plus bits/hex/value for display
 *
 * @param {object} operand
 * @param {'decimal'|'hex'} operand.format
 * @param {string} label   'A' or 'B' (only used to make error messages readable)
 * @returns {{ok:true, sign:number, special:string|null, digits:string|null,
 *             q:number|null, bits:string, hex:string, value:string}
 *          | {ok:false, error:string}}
 */
export function decodeOperand(operand, label) {
  if (!operand || typeof operand !== 'object') {
    return { ok: false, error: `Operand ${label} is missing.` };
  }

  if (operand.format === 'hex') {
    const raw = (operand.hex || '').trim();
    const hex = raw.toUpperCase();
    if (!/^[0-9A-F]{8}$/.test(hex)) {
      return {
        ok: false,
        error: `Operand ${label} needs exactly 8 hex characters (0-9, A-F), got "${raw}".`,
      };
    }
    const bits = hexToBits(hex);
    const decoded = decodeBits(bits);
    const value = decoded.special
      ? (decoded.sign ? '-' : '') +
        (decoded.special === 'infinity' ? 'Infinity' : decoded.special === 'snan' ? 'sNaN' : 'NaN')
      : toNumberString(decoded.sign, decoded.digits, decoded.q);

    return {
      ok: true,
      sign: decoded.sign,
      special: decoded.special,
      digits: decoded.special ? null : decoded.digits,
      q: decoded.special ? null : decoded.q,
      bits,
      hex,
      value,
    };
  }

  // decimal format
  const converted = convert(operand);
  if (!converted.ok) {
    return { ok: false, error: `Operand ${label}: ${converted.error}` };
  }

  return {
    ok: true,
    sign: converted.sign,
    special: converted.special,
    digits: converted.special ? null : converted.coefficient,
    q: converted.special ? null : converted.q,
    bits: converted.bits,
    hex: converted.hex,
    value: converted.value,
  };
}


/** @returns {{special, sign, digits:null, q:null, value, bits, hex}} */
export function specialResult(sign, special) {
  const fields = encodeSpecial(sign, special);
  const bits = fields.sign + fields.combination + fields.exponentContinuation + fields.coefficientContinuation;
  return {
    special,
    sign,
    digits: null,
    q: null,
    value:
      (sign ? '-' : '') + (special === 'infinity' ? 'Infinity' : special === 'snan' ? 'sNaN' : 'NaN'),
    bits,
    hex: bitsToHex(bits),
  };
}

// reencodes a plain finite result
export function encodeFiniteResult(sign, digits, q) {
  const padded = digits.padStart(PRECISION, '0');
  const fields = encodeFinite(sign, padded, q);
  const bits = fields.sign + fields.combination + fields.exponentContinuation + fields.coefficientContinuation;
  return {
    special: null,
    sign,
    digits: padded,
    q,
    value: toNumberString(sign, padded, q),
    bits,
    hex: bitsToHex(bits),
  };
}

/** @returns a signed zero result, q pinned to 0 since zero has no significant digits anyway */
export function zeroResult(sign) {
  return encodeFiniteResult(sign, '0'.repeat(PRECISION), 0);
}

// special cases 
/**
 * checks the inf/NaN/zero combinations before any real math happens
 *
 * this takes the raw operands (same ones passed to operate()), it
 * decodes them itself. if decoding fails this just returns null instead of
 * surfacing the error. operate() does its own decode right after and that's
 * where a bad input error actually gets reported, a malformed operand isn't
 * really a "special case" in the inf/NaN/zero sense
 *
 * @returns {{result:object, detail:string}|null}
 */
export function checkSpecialCases(operandA, operandB, operation) {
  const a = decodeOperand(operandA, 'A');
  const b = decodeOperand(operandB, 'B');
  if (!a.ok || !b.ok) return null;

  if (a.special === 'nan' || a.special === 'snan' || b.special === 'nan' || b.special === 'snan') {
    const sawSignaling = a.special === 'snan' || b.special === 'snan';
    return {
      result: specialResult(0, 'nan'),
      detail: sawSignaling
        ? 'One operand is a signaling NaN (sNaN), which raises the invalid-operation flag; the result is quiet NaN.'
        : 'One operand is NaN, so the result is NaN.',
    };
  }

  const aIsInf = a.special === 'infinity';
  const bIsInf = b.special === 'infinity';
  const aIsZero = !a.special && /^0*$/.test(a.digits);
  const bIsZero = !b.special && /^0*$/.test(b.digits);

  if (operation === 'subtract') {
    if (aIsInf && bIsInf) {
      // subtracting is adding the negation. same-signed infinities cancel to NaN, opposite signed infinities add up to a signed infinity
      if (a.sign === b.sign) {
        return {
          result: specialResult(0, 'nan'),
          detail: "Infinity minus an infinity of the same sign is NaN, they don't actually cancel out.",
        };
      }
      return {
        result: specialResult(a.sign, 'infinity'),
        detail: 'Infinity minus an infinity of the opposite sign stays infinite; the sign carries over from operand A.',
      };
    }
    if (aIsInf) {
      return {
        result: specialResult(a.sign, 'infinity'),
        detail: 'Operand A is infinite, so the result is that same infinity no matter what B is.',
      };
    }
    if (bIsInf) {
      return {
        result: specialResult(1 - b.sign, 'infinity'),
        detail: 'Operand B is infinite; subtracting an infinity flips its sign onto the result.',
      };
    }
    return null; // both finite. the real subtraction math handles it, including x - x = +0
  }

  if (operation === 'divide') {
    const resultSign = a.sign ^ b.sign;
    if (aIsInf && bIsInf) {
      return { result: specialResult(0, 'nan'), detail: 'Infinity divided by infinity is NaN.' };
    }
    if (aIsZero && bIsZero) {
      return { result: specialResult(0, 'nan'), detail: 'Zero divided by zero is NaN.' };
    }
    if (bIsZero) {
      return {
        result: specialResult(resultSign, 'infinity'),
        detail: 'Dividing by zero gives infinity; the sign is the xor of the two operand signs.',
      };
    }
    if (aIsZero) {
      return { result: zeroResult(resultSign), detail: 'Zero divided by anything nonzero is zero.' };
    }
    if (aIsInf) {
      return { result: specialResult(resultSign, 'infinity'), detail: 'Infinity divided by a finite number is still infinity.' };
    }
    if (bIsInf) {
      return { result: zeroResult(resultSign), detail: 'A finite number divided by infinity is zero.' };
    }
    return null;
  }

  return null;
}

// step-by-step helpers
function describeOperand(label, decoded) {
  if (decoded.special) {
    return {
      label: `Decode operand ${label}`,
      detail: `${label} = ${decoded.value} — sign ${decoded.sign}, this is a special value (${decoded.special}), not a plain coefficient/exponent pair.`,
    };
  }
  return {
    label: `Decode operand ${label}`,
    detail: `${label} = ${decoded.value} → sign ${decoded.sign}, coefficient ${decoded.digits}, exponent ${decoded.q >= 0 ? '+' : ''}${decoded.q}.`,
  };
}

function stripLeadingZeros(digits) {
  const stripped = digits.replace(/^0+/, '');
  return stripped === '' ? '0' : stripped;
}

/**
 * shifts whichever operand has the bigger exponent left (appends zeros,
 * lowers its exponent) until both land on the same exponent
 */
function alignOperands(a, b) {
  let digitsA = stripLeadingZeros(a.digits);
  let digitsB = stripLeadingZeros(b.digits);
  let qA = a.q;
  let qB = b.q;

  if (qA > qB) {
    digitsA += '0'.repeat(qA - qB);
    qA = qB;
  } else if (qB > qA) {
    digitsB += '0'.repeat(qB - qA);
    qB = qA;
  }

  return { digitsA, digitsB, q: qA };
}

// subtraction 
/**
 * runs the actual subtraction on two already-decoded, already-finite
 * operands (checkSpecialCases has to have already ruled out inf/NaN by the
 * time this gets called)
 * @returns {{steps: object[], result: object}}
 */
function runSubtract(a, b) {
  const steps = [];

  const { digitsA, digitsB, q } = alignOperands(a, b);

  steps.push({
    label: 'Align exponents',
    detail:
      a.q === b.q
        ? `Both operands already share exponent ${q}, no shifting needed. A = ${digitsA}, B = ${digitsB}.`
        : `Exponents differ (A is ${a.q}, B is ${b.q}), so whichever one has the bigger exponent gets shifted left ` +
          `(zeros appended on the right, exponent lowered) until both land on ${q}. A becomes ${digitsA}, B becomes ${digitsB}.`,
  });

  // subtracting is adding the negation (flip B's sign)
  const flippedBSign = 1 - b.sign;
  const magA = BigInt(digitsA);
  const magB = BigInt(digitsB);

  let workingSign, workingMag, workDetail;
  if (a.sign === flippedBSign) {
    workingSign = a.sign;
    workingMag = magA + magB;
    workDetail =
      `Subtracting B means flipping its sign first (B's sign was ${b.sign}, flipped to ${flippedBSign}), which matches A's sign, ` +
      `so this becomes a plain addition: ${digitsA} + ${digitsB} = ${workingMag.toString()}.`;
  } else if (magA >= magB) {
    workingSign = a.sign;
    workingMag = magA - magB;
    workDetail =
      `Subtracting B means flipping its sign first (B's sign was ${b.sign}, flipped to ${flippedBSign}), which differs from A's sign, ` +
      `so subtract the smaller magnitude from the larger: ${digitsA} - ${digitsB} = ${workingMag.toString()}, sign follows A (the bigger magnitude).`;
  } else {
    workingSign = flippedBSign;
    workingMag = magB - magA;
    workDetail =
      `Subtracting B means flipping its sign first (B's sign was ${b.sign}, flipped to ${flippedBSign}), which differs from A's sign, ` +
      `so subtract the smaller magnitude from the larger: ${digitsB} - ${digitsA} = ${workingMag.toString()}, sign follows B (the bigger magnitude).`;
  }

  steps.push({ label: 'Raw subtraction', detail: workDetail });

  let resultDigits = workingMag.toString();
  let resultSign = workingSign;
  const isZero = resultDigits === '0';
  if (isZero) {
    resultSign = 0; // x - x = +0, always positive zero in the default rounding mode
  }

  steps.push({
    label: 'Unrounded result',
    detail: isZero
      ? 'The magnitudes cancelled out exactly, so the unrounded result is zero. In the default rounding mode that is always positive zero, no matter what the intermediate signs looked like.'
      : `Unrounded result: sign ${resultSign}, digits ${resultDigits}, exponent ${q} (that's ${toNumberString(resultSign, resultDigits, q)}).`,
  });

  if (isZero) {
    const zr = zeroResult(0);
    steps.push({
      label: 'Round and re-encode',
      detail: `Zero doesn't need rounding, it's re-encoded directly as +0: bits ${zr.bits}, hex ${zr.hex}.`,
    });
    return { steps, result: zr };
  }

  // round back down to 7 digits using part 2, ties-to-even is decimal32's default rounding direction
  const rounded = roundOnce(resultDigits, resultSign, q, PRECISION, DEFAULT_ROUNDING_METHOD);
  const droppedCount = resultDigits.length > PRECISION ? resultDigits.length - PRECISION : 0;

  steps.push({
    label: 'Round to 7 digits',
    detail:
      droppedCount > 0
        ? `${resultDigits} has ${resultDigits.length} digits, decimal32 only keeps ${PRECISION}. Rounding with ties-to-even ` +
          `(the IEEE 754 default): keep the leading ${PRECISION} digits (${resultDigits.slice(0, PRECISION)}) and weigh the ` +
          `dropped ${droppedCount} digit(s) ("${resultDigits.slice(PRECISION)}") against exactly half to decide whether to ` +
          `bump the last kept digit. Rounded: sign ${rounded.sign}, digits ${rounded.digits}, exponent ${rounded.q}.`
        : `${resultDigits} already fits in ${PRECISION} digits, nothing gets thrown away.`,
  });

  // check the exponent still fits. if not, that's overflow or underflow
  let finalDigits = rounded.digits;
  let finalQ = rounded.q;
  let overflow = false;
  let underflow = false;
  const rangeNotes = [];

  if (finalQ > Q_MAX) {
    overflow = true;
    rangeNotes.push(
      `Overflow: after rounding the exponent needed is ${finalQ}, decimal32's max is ${Q_MAX}. Result becomes signed infinity.`
    );
  }

  let finalResult;
  if (overflow) {
    finalResult = specialResult(rounded.sign, 'infinity');
  } else if (underflow) {
    finalResult = zeroResult(rounded.sign);
  } else if (finalQ !== rounded.q) {
    finalResult = encodeFiniteResult(rounded.sign, finalDigits, finalQ);
  } else {
    finalResult = {
      special: null,
      sign: rounded.sign,
      digits: finalDigits,
      q: finalQ,
      value: rounded.value,
      bits: rounded.bits,
      hex: rounded.hex,
    };
  }

  steps.push({
    label: 'Re-encode final result',
    detail:
      rangeNotes.length > 0
        ? `${rangeNotes.join(' ')} Final: ${finalResult.value}${finalResult.hex ? `, hex ${finalResult.hex}.` : '.'}`
        : `Final: ${finalResult.value}, binary ${finalResult.bits}, hex ${finalResult.hex}.`,
  });

  return { steps, result: finalResult };
}

// the one function the (future) arithmetic controller actually calls

/**
 * runs the operation and gives back the answer plus every step.
 *
 * @param {object} operandA  same shape decodeOperand takes
 * @param {object} operandB 
 * @param {'subtract'|'divide'} operation
 * @returns {{ok:true, steps:object[], result:object} | {ok:false, error:string}}
 */
export function operate(operandA, operandB, operation) {
  if (!OPERATIONS.includes(operation)) {
    return { ok: false, error: `Unknown operation "${operation}", expected one of: ${OPERATIONS.join(', ')}.` };
  }

  const a = decodeOperand(operandA, 'A');
  if (!a.ok) return { ok: false, error: a.error };
  const b = decodeOperand(operandB, 'B');
  if (!b.ok) return { ok: false, error: b.error };

  const steps = [describeOperand('A', a), describeOperand('B', b)];

  const special = checkSpecialCases(operandA, operandB, operation);
  if (special) {
    steps.push({ label: 'Special case', detail: special.detail });
    return { ok: true, steps, result: special.result };
  }

  if (operation === 'subtract') {
    const { steps: mathSteps, result } = runSubtract(a, b);
    return { ok: true, steps: [...steps, ...mathSteps], result };
  }

  // TODO division (decodeOperand, specialResult, zeroResult and encodeFiniteResult above can be reused, checkSpecialCases already covers
  // every division special case too what's missing is just the long-division loop + rounding + range check
  throw new Error(
    'Division is not implemented yet - only subtract is done in src/model/arithmetic.js, see the TODO in operate().'
  );
}
