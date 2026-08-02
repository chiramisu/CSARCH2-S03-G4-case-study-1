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

  
*/

// import { decodeBits, hexToBits, encodeFinite } from './decimal32.js';
// import { roundAll } from './rounding.js';

export const OPERATIONS = ['subtract', 'divide'];

/**
 * TODO runs the operation and gives back the answer plus every step
 * @returns {object} something like { ok, steps: [], result: {...} }
 */
export function operate(operandA, operandB, operation) {
  throw new Error('Part 3 is not implemented yet, see the TODO block in src/model/arithmetic.js');
}

/**
 * TODO handles the inf / NaN / zero combinations before we bother doing any
 * real math, call this first and if it returns something just use that
 * @returns {object|null} the special result, or null when both operands are normal
 */
export function checkSpecialCases(operandA, operandB, operation) {
  throw new Error('Part 3 is not implemented yet, see the TODO block in src/model/arithmetic.js');
}
