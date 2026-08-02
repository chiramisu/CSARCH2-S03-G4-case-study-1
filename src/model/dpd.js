/*
  MODEL - Densely Packed Decimal (DPD)

  this file is the lowest level part of the model, it only knows how to squeeze
  3 decimal digits into 10 bits and pull them back out again, it does not know
  anything about IEEE754 or exponents or signs, decimal32.js handles all of that

  why 10 bits for 3 digits, cause 3 digits go from 000 to 999 which is 1000
  possible values and 2^10 is 1024 so it barely fits, if we did plain BCD it
  would take 12 bits so DPD saves us 2 bits per 3 digits which is where the
  20 bit coefficient continuation field comes from (2 declets = 6 digits)

  the naming of the bits below (a b c d / e f g h / i j k m) is straight from
  the IEEE 754-2008 standard so if you open the standard or the wikipedia page
  for densely packed decimal the letters will line up and you can check the
  table yourself, note that they skip the letter "l" probably cause it looks
  like a 1
*/

// turns one digit 0-9 into an array of its 4 bits, msb first
function digitToBits(digit) {
  return [(digit >> 3) & 1, (digit >> 2) & 1, (digit >> 1) & 1, digit & 1];
}

// turns 4 bits back into a number
function bitsToDigit(bits) {
  return (bits[0] << 3) | (bits[1] << 2) | (bits[2] << 1) | bits[3];
}

/**
 * squeezes 3 digits into a 10 bit declet
 * @param {number} d1 most significant digit of the group, 0 to 9
 * @param {number} d2 middle digit, 0 to 9
 * @param {number} d3 least significant digit, 0 to 9
 * @returns {string} 10 characters of "0" and "1"
 */
export function encodeDeclet(d1, d2, d3) {
  const [a, b, c, d] = digitToBits(d1);
  const [e, f, g, h] = digitToBits(d2);
  const [i, j, k, m] = digitToBits(d3);

  // a, e, i are the top bit of each digit, if the top bit is 1 the digit is
  // either 8 or 9 (1000 or 1001) which is the "large" case, so this 3 bit
  // number tells us which of the 8 rows of the encoding table we are in
  const aei = (a << 2) | (e << 1) | i;

  let p, q, r, s, t, u, v, w, x, y;
  switch (aei) {
    case 0b000: // all three digits are small (0-7)
      [p, q, r] = [b, c, d]; [s, t, u] = [f, g, h]; v = 0; [w, x, y] = [j, k, m];
      break;
    case 0b001: // only the last digit is big
      [p, q, r] = [b, c, d]; [s, t, u] = [f, g, h]; v = 1; [w, x, y] = [0, 0, m];
      break;
    case 0b010: // only the middle digit is big
      [p, q, r] = [b, c, d]; [s, t, u] = [j, k, h]; v = 1; [w, x, y] = [0, 1, m];
      break;
    case 0b011: // middle and last are big
      [p, q, r] = [b, c, d]; [s, t, u] = [1, 0, h]; v = 1; [w, x, y] = [1, 1, m];
      break;
    case 0b100: // only the first digit is big
      [p, q, r] = [j, k, d]; [s, t, u] = [f, g, h]; v = 1; [w, x, y] = [1, 0, m];
      break;
    case 0b101: // first and last are big
      [p, q, r] = [f, g, d]; [s, t, u] = [0, 1, h]; v = 1; [w, x, y] = [1, 1, m];
      break;
    case 0b110: // first and middle are big
      [p, q, r] = [j, k, d]; [s, t, u] = [0, 0, h]; v = 1; [w, x, y] = [1, 1, m];
      break;
    default: // 0b111, all three are big
      [p, q, r] = [0, 0, d]; [s, t, u] = [1, 1, h]; v = 1; [w, x, y] = [1, 1, m];
      break;
  }

  return [p, q, r, s, t, u, v, w, x, y].join('');
}

/**
 * pulls the 3 digits back out of a 10 bit declet, we mostly use this to double
 * check ourselves and for the read back display, but part 3 (arithmetic) is
 * gonna need this a lot when we take hex input from the user
 * @param {string} bits 10 characters of "0" and "1"
 * @returns {number[]} the 3 digits
 */
export function decodeDeclet(bits) {
  const [p, q, r, s, t, u, v, w, x, y] = bits.split('').map(Number);

  let d1, d2, d3;
  if (v === 0) {
    // easy case, its just 3 small digits sitting there in plain bcd
    d1 = [0, p, q, r]; d2 = [0, s, t, u]; d3 = [0, w, x, y];
  } else {
    const wx = (w << 1) | x;
    if (wx === 0b00) {
      d1 = [0, p, q, r]; d2 = [0, s, t, u]; d3 = [1, 0, 0, y];
    } else if (wx === 0b01) {
      d1 = [0, p, q, r]; d2 = [1, 0, 0, u]; d3 = [0, s, t, y];
    } else if (wx === 0b10) {
      d1 = [1, 0, 0, r]; d2 = [0, s, t, u]; d3 = [0, p, q, y];
    } else {
      // wx is 11 so now s and t are the ones telling us which digits are big
      const st = (s << 1) | t;
      if (st === 0b00) {
        d1 = [1, 0, 0, r]; d2 = [1, 0, 0, u]; d3 = [0, p, q, y];
      } else if (st === 0b01) {
        d1 = [1, 0, 0, r]; d2 = [0, p, q, u]; d3 = [1, 0, 0, y];
      } else if (st === 0b10) {
        d1 = [0, p, q, r]; d2 = [1, 0, 0, u]; d3 = [1, 0, 0, y];
      } else {
        d1 = [1, 0, 0, r]; d2 = [1, 0, 0, u]; d3 = [1, 0, 0, y];
      }
    }
  }

  return [bitsToDigit(d1), bitsToDigit(d2), bitsToDigit(d3)];
}

/**
 * convenience wrapper, takes a 3 character string like "420" and gives the declet
 */
export function encodeDecletFromString(three) {
  return encodeDeclet(
    Number(three[0]),
    Number(three[1]),
    Number(three[2])
  );
}
