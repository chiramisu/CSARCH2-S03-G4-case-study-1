/*
  
  MODEL - PART 2, DEMONSTRATE ROUNDING METHODS      *** NOT BUILT YET ***

  this file is empty on purpose, part 1 is done and this is the next one, i left
  the function names already written below so please dont rename them, the
  controller is gonna import them exactly like this

  WHAT SIR IS ASKING FOR (copied from the spec so nobody has to keep opening
  the pdf)
    a. input, a number in either decimal or binary format
    b. input, the target number of digits to be rounded
    c. output, the rounded results using all four methods, chopping, round up,
       round down, and round to nearest ties to even

  so the four methods all show at the SAME TIME, its not a dropdown where you
  pick one, thats the whole point of the exercise, you want to see them side by
  side and see where they disagree

  
  THE FOUR METHODS, the short version

  say we are keeping 3 digits and the number is 1.2345

    chopping        just cut it, whatever is past the cut is gone, 1.23
                    also called truncation, this is the easiest one by far
    round up        go toward positive infinity, so 1.2345 becomes 1.24 but
                    -1.2345 becomes -1.23
    round down      go toward negative infinity, so 1.2345 becomes 1.23 but
                    -1.2345 becomes -1.24
    ties to even    normally just go to whichever is closer, the "ties" part
                    only matters when the leftover is EXACTLY half, and then
                    you pick whichever option ends in an even digit

  THE TRAP nobody catches the first time, round up is NOT the same as "away
  from zero" and round down is NOT the same as "toward zero", the sign flips
  which one is which, chopping on the other hand IS toward zero always, we
  will lose points if this is wrong so please write a test for a negative
  number, like -1.2345 to 3 digits should give
    chop  -1.23
    up    -1.23
    down  -1.24
    ties  -1.23
  notice chop and up and ties all agree there and only down is different, if
  all four of your answers are the same for every input you probably broke
  something

  THE OTHER TRAP, ties to even only kicks in when the thrown away part is
  exactly one half of the last kept digit, like 1.25 rounding to 2 digits, not
  when it is 1.26 or 1.24, for 1.25 the two choices are 1.2 and 1.3 and since
  2 is the even one the answer is 1.2, and for 1.35 the answer is 1.4 cause 4
  is even, thats why its called ties to EVEN and not "round half down"

  
  HOW TO ACTUALLY BUILD IT

  use strings and BigInt, do not use javascript numbers, if you do the whole
  thing with parseFloat you will get stuff like 0.1 + 0.2 problems and the
  whole point of this machine is that decimal is supposed to be exact, part 1
  already does everything as digit strings so copy that style, look at
  fitCoefficient in decimal32.js for the pattern

  rough plan
    1. parse the input into sign, digit string, exponent, and you can literally
       reuse parseInput from decimal32.js for the decimal case, it already
       returns exactly that shape
    2. figure out where the cut lands, that is which digit index we keep up to
    3. split the digit string into the kept part and the thrown away part
    4. decide per method whether the kept part gets +1 on its last digit
         chop  never
         up    add 1 if we threw away anything that is not all zeros AND the
               number is positive
         down  add 1 if we threw away anything that is not all zeros AND the
               number is negative
         ties  compare the thrown away part against exactly half, bigger means
               add 1, smaller means dont, exactly equal means only add 1 if the
               last kept digit is odd
    5. adding 1 can carry all the way up like 999 becoming 1000, when that
       happens you gained a digit so you have to shift and bump the exponent,
       handle it, this is the case everybody forgets
    6. the binary input case, the spec says the input can be binary too, so
       take the bits, run decodeBits from decimal32.js to get the digits back,
       then do the exact same thing, dont write the rounding twice

  and the outputs need the same readability options as part 1 so once you have
  the result just re encode it with encodeFinite from decimal32.js and pass the
  bits to groupBits and groupHex in view.js, they already exist

  
*/

import { parseInput, decodeBits, hexToBits, toNumberString } from './decimal32.js';

export const ROUNDING_METHODS = ['chop', 'up', 'down', 'tiesToEven'];

/**
 * TODO rounds one number and gives back all four answers at once
 * @param {object} input   same shape part 1 uses, plus a digits target
 * @returns {object} something like { ok, results: { chop, up, down, tiesToEven } }
 */
export function roundAll(input) {
   const keep = input.keep;

  let sign, digits, q, special;

  if (input.format === 'binary') {
    const bits = input.bits || (input.hex ? hexToBits(input.hex) : null);
    if (!bits) {
      return { ok: false, error: 'Give either 32 bits or 8 hex characters for the binary input.' };
    }
    if (bits.length !== 32 || /[^01]/.test(bits)) {
      return { ok: false, error: 'Binary input has to be exactly 32 bits, only 0s and 1s.' };
    }
    const decoded = decodeBits(bits);
    sign = decoded.sign;
    special = decoded.special;
    digits = decoded.digits;
    q = decoded.q;
  } else {
    const parsed = parseInput(input);
    if (!parsed.ok) return parsed;
    sign = parsed.sign;
    special = parsed.special;
    digits = parsed.digits;
    q = parsed.q;
  }

  // rounding doesn't mean anything for infinity / NaN, they just pass through
  // unchanged on all four methods, this covers the "including special cases"
  // requirement from the general spec
  if (special) {
    const label =
      (sign ? '-' : '') + (special === 'infinity' ? 'Infinity' : special === 'snan' ? 'sNaN' : 'NaN');
    const results = {};
    for (const method of ROUNDING_METHODS) {
      results[method] = { ok: true, special, sign, value: label };
    }
    return { ok: true, special, sign, digits: null, q: null, keep, results };
  }

  if (!Number.isInteger(keep) || keep < 1) {
    return { ok: false, error: 'Target number of digits has to be a whole number of at least 1.' };
  }

  const results = {};
  for (const method of ROUNDING_METHODS) {
    results[method] = roundOnce(digits, sign, q, keep, method);
  }

  return { ok: true, special: null, sign, digits, q, keep, results };
}

/**
 * TODO the single method version, roundAll should just call this four times
 * @param {string} digits    the digit string, no sign no dot
 * @param {number} sign      0 or 1, the methods need it, up and down flip on sign
 * @param {number} q         the exponent that goes with those digits
 * @param {number} keep      how many digits we are keeping
 * @param {string} method    one of ROUNDING_METHODS
 */
export function roundOnce(digits, sign, q, keep, method) {
    if (!ROUNDING_METHODS.includes(method)) {
    return { ok: false, error: `Unknown rounding method "${method}".` };
  }

  if (!Number.isInteger(keep) || keep < 1) {
    return { ok: false, error: 'Target number of digits has to be a whole number of at least 1.' };
  }

  // strip leading zeros, they don't change the integer value so they don't
  // change the exponent math and they're just padding
  let d = digits.replace(/^0+/, '');
  if (d === '') {
    d = '0';
  }

  // nothing to round if it's zero, or if we already have <= keep digits
  if (d === '0' || d.length <= keep) {
    return { ok: true, sign, digits: d, q, value: toNumberString(sign, d, q) };
  }

  const kept = d.slice(0, keep);
  const thrown = d.slice(keep);
  let qOut = q + thrown.length; // we dropped thrown.length digits off the right

  const thrownIsZero = /^0+$/.test(thrown);
  let addOne = false;

  if (!thrownIsZero) {
    if (method === 'chop') {
      addOne = false;
    } else if (method === 'up') {
      // toward +infinity: only makes positive numbers bigger
      addOne = sign === 0;
    } else if (method === 'down') {
      // toward -infinity: only makes negative numbers more negative
      addOne = sign === 1;
    } else {
      // tiesToEven
      const half = '5' + '0'.repeat(thrown.length - 1);
      const thrownBig = BigInt(thrown);
      const halfBig = BigInt(half);
      if (thrownBig > halfBig) {
        addOne = true;
      } else if (thrownBig < halfBig) {
        addOne = false;
      } else {
        // exactly half, tie goes to whichever choice leaves an even digit
        const lastKeptDigit = Number(kept[kept.length - 1]);
        addOne = lastKeptDigit % 2 === 1;
      }
    }
  }

  let finalDigits = kept;
  if (addOne) {
    const bumped = (BigInt(kept) + 1n).toString();
    const extra = bumped.length - keep; // 999 -> 1000 case, extra === 1
    if (extra > 0) {
      finalDigits = bumped.slice(0, keep); // drop the trailing zero(s) the carry added
      qOut += extra; // and push the exponent up
    } else {
      finalDigits = bumped;
    }
  }

  return { ok: true, sign, digits: finalDigits, q: qOut, value: toNumberString(sign, finalDigits, qOut) };
}