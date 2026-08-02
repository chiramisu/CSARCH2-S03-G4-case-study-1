/*
  quick sanity checks, run it with "npm run check", its not a real test
  framework or anything i just wanted proof the encoder is not lying before we
  record the video, if you add features add a case here too
*/

import { encodeDeclet, decodeDeclet } from '../src/model/dpd.js';
import { convert, decodeBits, hexToBits } from '../src/model/decimal32.js';

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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
