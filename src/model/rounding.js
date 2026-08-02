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

// import { parseInput, encodeFinite, decodeBits } from './decimal32.js';

export const ROUNDING_METHODS = ['chop', 'up', 'down', 'tiesToEven'];

/**
 * TODO rounds one number and gives back all four answers at once
 * @param {object} input   same shape part 1 uses, plus a digits target
 * @returns {object} something like { ok, results: { chop, up, down, tiesToEven } }
 */
export function roundAll(input) {
  throw new Error('Part 2 is not implemented yet, see the TODO block in src/model/rounding.js');
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
  throw new Error('Part 2 is not implemented yet, see the TODO block in src/model/rounding.js');
}
