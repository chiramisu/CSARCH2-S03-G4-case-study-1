/*
  quick sanity checks, run it with "npm run check", its not a real test
  framework or anything i just wanted proof the encoder is not lying before we
  record the video, if you add features add a case here too
*/

import { encodeDeclet, decodeDeclet } from '../src/model/dpd.js';
import { convert, decodeBits, hexToBits } from '../src/model/decimal32.js';
import { roundOnce, roundAll } from '../src/model/rounding.js';
import { operate } from '../src/model/arithmetic.js';

let pass = 0;
let fail = 0;

function check(name, got, want) {
  if (got === want) {
    pass += 1;
  } else {
    fail += 1;
    console.log(`FAIL ${name}\n  got  ${got}\n  want ${want}`);
  }
}

// every single 3 digit group has to survive encode then decode
for (let d1 = 0; d1 < 10; d1 += 1) {
  for (let d2 = 0; d2 < 10; d2 += 1) {
    for (let d3 = 0; d3 < 10; d3 += 1) {
      const bits = encodeDeclet(d1, d2, d3);
      const back = decodeDeclet(bits).join('');
      check(`declet ${d1}${d2}${d3}`, back, `${d1}${d2}${d3}`);
      check(`declet width ${d1}${d2}${d3}`, String(bits.length), '10');
    }
  }
}

// declet values straight from the standards table
check('dpd 000', encodeDeclet(0, 0, 0), '0000000000');
check('dpd 005', encodeDeclet(0, 0, 5), '0000000101');
check('dpd 009', encodeDeclet(0, 0, 9), '0000001001');
check('dpd 099', encodeDeclet(0, 9, 9), '0001011111');
check('dpd 999', encodeDeclet(9, 9, 9), '0011111111');
check('dpd 890', encodeDeclet(8, 9, 0), '0000011110');

// known whole encodings
const cases = [
  [{ mode: 'plain', plain: '0' }, '22500000'],
  [{ mode: 'plain', plain: '1' }, '22500001'],
  [{ mode: 'plain', plain: '-1' }, 'A2500001'],
  [{ mode: 'plain', plain: '9999999' }, '6E53FCFF'],
  [{ mode: 'plain', plain: '-9999999' }, 'EE53FCFF'],
  [{ mode: 'plain', plain: 'Infinity' }, '78000000'],
  [{ mode: 'plain', plain: '-inf' }, 'F8000000'],
  [{ mode: 'plain', plain: 'NaN' }, '7C000000'],
  [{ mode: 'plain', plain: 'sNaN' }, '7E000000'],
];
for (const [input, hex] of cases) {
  const r = convert(input);
  check(`encode ${input.plain}`, r.ok ? r.hex : r.error, hex);
}

// bits always have to be 32 long and the read back has to match what we said
const roundTrip = ['420', '-420', '4.20', '0.00042', '1234567', '0.0000001', '7', '-0.5'];
for (const text of roundTrip) {
  const r = convert({ mode: 'plain', plain: text });
  check(`width ${text}`, String(r.bits.length), '32');
  check(`round trip ${text}`, r.readBack, r.value);
}

// scaled mode, 1234567 x 10^56 should be the same as typing the long number
const scaled = convert({ mode: 'scaled', significand: '1234567', exponent: '56' });
check('scaled 1234567e56 ok', String(scaled.ok), 'true');
check('scaled 1234567e56 value', scaled.value, '1.234567E+62');
check('scaled 1234567e56 round trip', scaled.readBack, scaled.value);

// cohorts, 420 and 4200e-1 are the same value but different bits on purpose
const a = convert({ mode: 'plain', plain: '420' });
const b = convert({ mode: 'scaled', significand: '4200', exponent: '-1' });
check('cohort values match', a.value + ' / ' + b.value, '420 / 420.0');
check('cohort bits differ', String(a.hex !== b.hex), 'true');

// hex back to bits back to digits
const dec = decodeBits(hexToBits(a.hex));
check('decode 420 digits', dec.digits, '0000420');
check('decode 420 exponent', String(dec.q), '0');

// the errors we are supposed to catch
const errors = [
  [{ mode: 'plain', plain: '12345678' }, 'too many digits'],
  [{ mode: 'scaled', significand: '9', exponent: '400' }, 'overflow'],
  [{ mode: 'scaled', significand: '9', exponent: '-400' }, 'underflow'],
  [{ mode: 'plain', plain: 'hello' }, 'garbage input'],
  [{ mode: 'plain', plain: '' }, 'empty'],
];
for (const [input, label] of errors) {
  const r = convert(input);
  check(`error caught, ${label}`, String(r.ok), 'false');
}


// ===========================================================================
// PART 2, ROUNDING
// ===========================================================================

// the negative number trap from the todo block, if all four of these come out
// the same somebody broke the sign handling
const negative = { chop: '-1.23', up: '-1.23', down: '-1.24', tiesToEven: '-1.23' };
for (const [method, want] of Object.entries(negative)) {
  check(`round -1.2345 keep 3 ${method}`, roundOnce('12345', 1, -4, 3, method).value, want);
}

// same number but positive, now up and down swap places
const positive = { chop: '1.23', up: '1.24', down: '1.23', tiesToEven: '1.23' };
for (const [method, want] of Object.entries(positive)) {
  check(`round 1.2345 keep 3 ${method}`, roundOnce('12345', 0, -4, 3, method).value, want);
}

// ties to even only kicks in on an exact half, and it picks the even neighbour
check('ties 1.25 keep 2', roundOnce('125', 0, -2, 2, 'tiesToEven').value, '1.2');
check('ties 1.35 keep 2', roundOnce('135', 0, -2, 2, 'tiesToEven').value, '1.4');
check('ties 1.26 keep 2', roundOnce('126', 0, -2, 2, 'tiesToEven').value, '1.3');
check('ties 1.24 keep 2', roundOnce('124', 0, -2, 2, 'tiesToEven').value, '1.2');

// the carry case everybody forgets, 999.9 rounding up turns into 1000 which is
// one digit too many so the exponent has to absorb it
check('carry 999.9 up', roundOnce('9999', 0, -1, 3, 'up').value, '1.00E+3');
check('carry 999.9 chop', roundOnce('9999', 0, -1, 3, 'chop').value, '999');

// nothing to throw away means nothing changes on any method
for (const method of ['chop', 'up', 'down', 'tiesToEven']) {
  check(`no-op round 42 ${method}`, roundOnce('42', 0, 0, 7, method).value, '42');
}

// roundAll wiring, decimal in, four answers out, each re-encoded to hex
const ra = roundAll({ format: 'decimal', mode: 'plain', plain: '1.2345678', keep: 7 });
check('roundAll ok', String(ra.ok), 'true');
check('roundAll chop', ra.results.chop.value, '1.234567');
check('roundAll up', ra.results.up.value, '1.234568');
check('roundAll ties', ra.results.tiesToEven.value, '1.234568');
check('roundAll chop hex', ra.results.chop.hex, '25F4D2E7');

// an empty keep box should fall back to the format's own 7 digits
const raDefault = roundAll({ format: 'decimal', mode: 'plain', plain: '1.2345678' });
check('roundAll default keep', String(raDefault.keep), '7');

// hex in, rounded, back out
const raHex = roundAll({ format: 'binary', hex: '22500220', keep: 2 });
check('roundAll from hex', raHex.results.tiesToEven.value, '4.2E+2');

// specials just pass straight through all four methods
const raNaN = roundAll({ format: 'decimal', mode: 'plain', plain: 'NaN', keep: 3 });
check('roundAll NaN', raNaN.results.chop.hex, '7C000000');
const raInf = roundAll({ format: 'decimal', mode: 'plain', plain: '-inf', keep: 3 });
check('roundAll -inf', raInf.results.down.hex, 'F8000000');

// bad input has to be caught not crashed on
check('round rejects bad bits', String(roundAll({ format: 'binary', hex: 'ZZZZZZZZ', keep: 3 }).ok), 'false');
check('round rejects keep 0', String(roundAll({ format: 'decimal', mode: 'plain', plain: '5', keep: 0 }).ok), 'false');

// ===========================================================================
// PART 3, SUBTRACTION AND DIVISION
//
// the expected answers here are not made up, they came out of pythons decimal
// module set to decimal32 rules (7 digits, emax 96, emin -95, ties to even)
// and then encoded with our own encoder, so if one of these ever fails it
// means we drifted away from the standard not away from somebodys opinion
// ===========================================================================

// operand helper, handles the 1E+90 style since the plain parser wont take an E
function operand(text) {
  const match = /^(-?[\d.]+)E([+-]\d+)$/.exec(text);
  if (match) return { format: 'decimal', mode: 'scaled', significand: match[1], exponent: match[2] };
  return { format: 'decimal', mode: 'plain', plain: text };
}

function checkOp(a, b, operation, wantValue, wantHex) {
  const label = `${a} ${operation} ${b}`;
  let result;
  try {
    result = operate(operand(a), operand(b), operation);
  } catch (error) {
    check(label, 'threw: ' + error.message, `${wantValue} / ${wantHex}`);
    return;
  }
  if (!result.ok) {
    check(label, 'error: ' + result.error, `${wantValue} / ${wantHex}`);
    return;
  }
  check(label, `${result.result.value} / ${result.result.hex}`, `${wantValue} / ${wantHex}`);
}

// normal subtraction
checkOp('130', '125', 'subtract', '5', '22500005');
checkOp('-5', '3', 'subtract', '-8', 'A2500008');
checkOp('0.1', '0.3', 'subtract', '-0.2', 'A2400002');
checkOp('420', '420', 'subtract', '0', '22500000');

// this one is the important one, aligning 1 against 0.9999999 needs 8 digits
// during the work, if somebody truncates to 7 too early this comes out 0
checkOp('1', '0.9999999', 'subtract', '1E-7', '21E00001');

// 8 digits mid-work again but this time the answer keeps its half
checkOp('1000000', '0.5', 'subtract', '999999.5', '6E43FE9F');

// preferred exponent, the answer is 2.70 not 2.7, trailing zero is meaningful
checkOp('4.20', '1.5', 'subtract', '2.70', '22300170');

// 180 places apart, naive alignment loops die here
checkOp('1E+90', '1E-90', 'subtract', '1.000000E+90', '47900000');

// subtraction that runs off the top of the format
checkOp('-9.999999E+96', '9.999999E+96', 'subtract', '-Infinity', 'F8000000');

// division, including the ones that never terminate
checkOp('10', '4', 'divide', '2.5', '22400025');
checkOp('130', '125', 'divide', '1.04', '22300084');
checkOp('1', '3', 'divide', '0.3333333', '2DE6CDB3');
checkOp('2', '7', 'divide', '0.2857143', '29ED74C3');
checkOp('9.999999', '1E-95', 'divide', '9.999999E+95', '77E3FCFF');

// special cases, sir asked for these by name so they all get a test
checkOp('Infinity', 'Infinity', 'subtract', 'NaN', '7C000000');
checkOp('Infinity', '5', 'subtract', 'Infinity', '78000000');
checkOp('5', 'Infinity', 'subtract', '-Infinity', 'F8000000');
checkOp('NaN', '5', 'subtract', 'NaN', '7C000000');
checkOp('sNaN', '5', 'subtract', 'NaN', '7C000000');
checkOp('Infinity', 'Infinity', 'divide', 'NaN', '7C000000');
checkOp('1', '0', 'divide', 'Infinity', '78000000');
checkOp('0', '0', 'divide', 'NaN', '7C000000');
checkOp('Infinity', '5', 'divide', 'Infinity', '78000000');
checkOp('1E+90', '1E-90', 'divide', 'Infinity', '78000000');

// hex operands, 22500220 is 420 and 22500080 is 100
const fromHex = operate({ format: 'hex', hex: '22500220' }, { format: 'hex', hex: '22500080' }, 'subtract');
check('hex operands 420 - 100', fromHex.ok ? fromHex.result.value : 'ERR', '320');
check('hex operands hex out', fromHex.ok ? fromHex.result.hex : 'ERR', '225001A0');

// garbage in has to come back as a clean error not an exception
for (const [a, b, label] of [
  [{ format: 'hex', hex: 'ZZZ' }, { format: 'hex', hex: '22500080' }, 'bad hex'],
  [operand('hello'), operand('5'), 'bad decimal'],
  [operand(''), operand('5'), 'empty operand'],
]) {
  let ok;
  try {
    ok = String(operate(a, b, 'subtract').ok);
  } catch (error) {
    ok = 'threw';
  }
  check(`operate rejects ${label}`, ok, 'false');
}

// the step by step is the graded part so make sure it is actually populated
const stepped = operate(operand('2'), operand('7'), 'divide');
check('division produces steps', String(stepped.steps.length >= 5), 'true');
check('steps have labels', String(stepped.steps.every((s) => s.label && s.detail)), 'true');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
