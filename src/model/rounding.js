/*
  
  MODEL - PART 2, DEMONSTRATE ROUNDING METHODS     

  part 1 is done and this is the next one, i left
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

/*
  MODEL - PART 2, DEMONSTRATE ROUNDING METHODS

  Reuses parseInput / decodeBits / hexToBits / toNumberString from decimal32.js
  so this file never re-implements digit parsing, it only implements the
  rounding math itself, all done in strings + BigInt, no floats anywhere.

  ---------------------------------------------------------------------------
  HOW A NUMBER IS CARRIED THROUGH THIS FILE

  Every number is (sign, digits, q) meaning value = (-1)^sign * digits * 10^q
  where `digits` is a plain string of decimal digits (no sign, no dot). This
  is exactly the shape parseInput / decodeBits already hand back, so rounding
  never has to touch a decimal point directly.

  ---------------------------------------------------------------------------
  THE FOUR METHODS (see roundOnce for the actual logic)

    chop        truncate, never touches the kept digits
    up          toward +infinity -> only bumps the kept digits for POSITIVE
                numbers with a nonzero thrown-away part
    down        toward -infinity -> only bumps the kept digits for NEGATIVE
                numbers with a nonzero thrown-away part
    tiesToEven  compare thrown-away part against exactly half of the last
                kept place, bigger bumps, smaller doesn't, exactly half bumps
                only if that keeps the last kept digit even
*/

import {
  parseInput,
  decodeBits,
  hexToBits,
  toNumberString,
  encodeFinite,
  encodeSpecial,
  bitsToHex,
  PRECISION,
  Q_MIN,
  Q_MAX,
} from './decimal32.js';

export const ROUNDING_METHODS = ['chop', 'up', 'down', 'tiesToEven'];

/**
 * Runs all four rounding methods on one number at once.
 *
 * @param {object} input
 * @param {'decimal'|'binary'} input.format
 *   'decimal' -> same shape parseInput takes: { mode: 'plain'|'scaled', plain, significand, exponent }
 *   'binary'  -> either { bits: '<32 chars of 0/1>' } or { hex: '<8 hex chars>' }
 * @param {number} input.keep  target number of digits to round to
 * @returns {{ ok:true, special:string|null, sign:number, digits:string, q:number,
 *             keep:number, results:{ chop, up, down, tiesToEven } }
 *          | { ok:false, error:string }}
 */
export function roundAll(input) {
  // decimal32's own precision is 7 digits, so 7 is the natural default here,
  // it's what you'd type to see "how does this get squeezed to fit the format"
  const keep = Number.isInteger(input.keep) ? input.keep : PRECISION;

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
    const encoded = encodeSpecialAsBits(sign, special);
    const results = {};
    for (const method of ROUNDING_METHODS) {
      results[method] = { ok: true, special, sign, value: label, bits: encoded.bits, hex: encoded.hex };
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
 * The single method version, roundAll should just call this four times
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
  // change the exponent math either, they're just padding
  let d = digits.replace(/^0+/, '');
  if (d === '') d = '0';

  // nothing to round if it's zero, or if we already have <= keep digits
  if (d === '0' || d.length <= keep) {
    const encoded = tryEncodeFinite(sign, d, q);
    return {
      ok: true,
      sign,
      digits: d,
      q,
      value: toNumberString(sign, d, q),
      bits: encoded ? encoded.bits : null,
      hex: encoded ? encoded.hex : null,
    };
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
      qOut += extra; // and push the exponent up to compensate
    } else {
      finalDigits = bumped;
    }
  }

  const encoded = tryEncodeFinite(sign, finalDigits, qOut);
  return {
    ok: true,
    sign,
    digits: finalDigits,
    q: qOut,
    value: toNumberString(sign, finalDigits, qOut),
    bits: encoded ? encoded.bits : null,
    hex: encoded ? encoded.hex : null,
  };
}

// ---------------------------------------------------------------------------
// NOTE:
// re-encoding a rounded result back to 32 bits, same idea as decimal32.js's
// convert(), this is the "give the outputs the same readability options as
// part 1" instruction from the plan up top
//
// this only works if the rounded coefficient fits in PRECISION (7) digits,
// which it always will when keep <= 7 (a shorter coefficient just gets
// padded with LEADING zeros, same trick fitCoefficient uses in decimal32.js,
// leading zeros don't change the integer value so the exponent doesn't move)
// and only if the exponent landed inside the legal decimal32 range, if either
// of those fails we just skip the bits/hex and leave the decimal value as
// the only output for that case, no need to error the whole thing out over it
// ---------------------------------------------------------------------------

/**
 * Tries to re-encode a rounded (sign, digits, q) result back into 32 bits,
 * the same way decimal32.js's own convert() does it. Returns null instead of
 * throwing if it can't be done, callers just fall back to decimal-only output.
 *
 * Two ways this can fail:
 *   digits longer than 7   the rounding kept more than PRECISION digits, not
 *                          a valid decimal32 coefficient no matter how you
 *                          pad it, this only happens if someone calls roundAll
 *                          with keep > 7
 *   q outside Q_MIN..Q_MAX exponent doesn't fit in the 8 biased bits decimal32
 *                          has room for, same overflow/underflow idea as
 *                          fitCoefficient in decimal32.js, just without the
 *                          zero-padding rescue since we don't want to be
 *                          silently changing a rounding result's digits again
 *
 * @param {number} sign     0 or 1
 * @param {string} digits   rounded digit string, <= 7 digits, no sign no dot
 * @param {number} q        exponent that goes with `digits`
 * @returns {{ bits:string, hex:string } | null}
 */
function tryEncodeFinite(sign, digits, q) {
  if (digits.length > PRECISION) return null;
  if (q < Q_MIN || q > Q_MAX) return null;

  const padded = digits.padStart(PRECISION, '0');
  const fields = encodeFinite(sign, padded, q);
  const bits = fields.sign + fields.combination + fields.exponentContinuation + fields.coefficientContinuation;
  return { bits, hex: bitsToHex(bits) };
}

/**
 * Same idea as tryEncodeFinite but for infinity / NaN / sNaN, these always
 * encode successfully (no digit count or exponent range to worry about, the
 * coefficient bits are just zeroed out per the standard) so this never
 * returns null, unlike tryEncodeFinite.
 *
 * @param {number} sign               0 or 1
 * @param {'infinity'|'nan'|'snan'} special
 * @returns {{ bits:string, hex:string }}
 */
function encodeSpecialAsBits(sign, special) {
  const fields = encodeSpecial(sign, special);
  const bits = fields.sign + fields.combination + fields.exponentContinuation + fields.coefficientContinuation;
  return { bits, hex: bitsToHex(bits) };
}



