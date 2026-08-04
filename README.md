# CSARCH2 Machine 4: Decimal 32-bit Floating-Point Machine

Group 4, S03. Web simulation of IEEE 754 decimal32 (decimal single precision,
densely packed decimal encoding).

- **Live site:** https://chiramisu.github.io/CSARCH2-S03-G4-case-study-1/
- **Video walkthrough:** https://youtu.be/CS-QxQ9s8cE

## Status

All three parts of the machine are built and working.

| Part | What it does | State |
|---|---|---|
| 1 | Convert decimal to decimal32 | Done |
| 2 | Demonstrate the four rounding methods | Done |
| 3 | Subtraction and division with step-by-step solution | Done |

## Running it

```
npm install
npm run dev      # local dev server
npm run build    # static build into dist/
npm run preview  # serve the built site
npm run check    # 2103 assertions across all three parts
```

Node 18 or newer. There is no backend and no database, the whole thing runs in
the browser.

## How the code is laid out (MVC)

The model never touches the DOM, the view never does math, and the controller is
the only thing that knows both exist. Each part gets its own view and controller
so the files stay small and merge cleanly.

```
index.html                              markup only, no logic
vite.config.js                          build config, base: './' for GitHub Pages
src/main.js                             boots the three MVC triples
src/style.css                           styling

src/model/dpd.js                        3 decimal digits <-> 10 bit declet
src/model/decimal32.js                  parsing, range checking, encode, decode
src/model/rounding.js                   PART 2, the four rounding methods
src/model/arithmetic.js                 PART 3, subtraction and division

src/view/view.js                        PART 1 view, plus the shared bit/hex grouping helpers
src/view/roundingView.js                PART 2 view
src/view/arithmeticView.js              PART 3 view

src/controller/controller.js            PART 1 controller
src/controller/roundingController.js    PART 2 controller
src/controller/arithmeticController.js  PART 3 controller

test/check.mjs                          checks for all three parts
```

## The format

```
[ 1 sign ][ 5 combination ][ 6 exponent continuation ][ 20 densely packed BCD ]
```

Precision is 7 digits, the exponent bias is 101, and the stored exponent runs
from -101 to 90. The value is `(-1)^sign * coefficient * 10^exponent`.

Two things make decimal32 different from the binary formats in Machines 2 and 3.
First, the coefficient is a plain 7 digit integer, there is no hidden bit and no
normalization. Second, the most significant digit is not stored on its own, it is
packed into the 5 combination bits together with the top 2 bits of the exponent,
which is why you cannot just slice the exponent out in one piece.

Because there is no normalization, the same value can have more than one valid
encoding. `420` and `4200 x 10^-1` are both exactly 420 but they produce
different bit patterns. That is called a cohort and it is normal for decimal
formats, not a bug. The app preserves whatever the user typed, so `4.20` stays
`420 x 10^-2` instead of being squashed to `42 x 10^-1`.

## Part 1: Convert decimal to decimal32

Two input modes. Plain decimal, where typing `420` means 420 x 10^0, and
significand with a custom base 10 exponent for things like 1234567 x 10^56.

Binary output can be grouped by bit field, by nibble, or by byte. Hex output can
be one continuous string, or split every 2 or every 4 hex digits.

| Input | Hex |
|---|---|
| 0 | 22500000 |
| 1 | 22500001 |
| -1 | A2500001 |
| 100 | 22500080 |
| 420 | 22500220 |
| 4.20 | 22300220 |
| 9999999 | 6E53FCFF |
| 1234567 x 10^56 | 45D4D2E7 |
| Infinity | 78000000 |
| -Infinity | F8000000 |
| NaN | 7C000000 |
| sNaN | 7E000000 |

Error cases: too many significant digits (`12345678`), overflow (9 x 10^400),
underflow (9 x 10^-400), and garbage input (`hello`).

## Part 2: Rounding methods

Input is either a decimal number or a decimal32 value given as 32 bits or as 8
hex characters, plus a target number of digits to keep. All four methods are
shown at once so you can see where they disagree.

Round up means toward positive infinity and round down means toward negative
infinity, which is **not** the same as away from zero and toward zero. The sign
decides which is which. Chopping is always toward zero.

Rounding -1.2345 to 3 digits:

| Method | Result |
|---|---|
| Chopping | -1.23 |
| Round up | -1.23 |
| Round down | -1.24 |
| Ties to even | -1.23 |

The same number positive, 1.2345 to 3 digits, swaps round up and round down:

| Method | Result |
|---|---|
| Chopping | 1.23 |
| Round up | 1.24 |
| Round down | 1.23 |
| Ties to even | 1.23 |

Ties to even only applies when the discarded part is exactly half, so 1.25 to 2
digits gives 1.2 while 1.35 gives 1.4, each time landing on the even digit.
Rounding 999.9 up to 3 digits carries all the way to 1.00E+3, which gains a digit
and pushes the exponent up.

## Part 3: Subtraction and division

Each operand can be typed as a decimal or as an 8 character IEEE hex string. The
output gives the final result in decimal, binary with spacing, and hexadecimal,
plus the full step-by-step solution: both operands decoded, the exponent
alignment, the raw subtraction or long division, the unrounded result, the
rounding step, and the re-encoded answer.

Results are rounded to 7 digits using round-to-nearest ties-to-even, which is the
IEEE default rounding direction.

The expected values below were produced independently using Python's `decimal`
module configured to decimal32 rules (7 digits, Emax 96, Emin -95, ties to even),
then encoded with our own encoder, so they check the implementation against the
standard rather than against itself.

| A | Operation | B | Result | Hex |
|---|---|---|---|---|
| 130 | subtract | 125 | 5 | 22500005 |
| -5 | subtract | 3 | -8 | A2500008 |
| 0.1 | subtract | 0.3 | -0.2 | A2400002 |
| 420 | subtract | 420 | 0 | 22500000 |
| 1 | subtract | 0.9999999 | 1E-7 | 21E00001 |
| 1000000 | subtract | 0.5 | 999999.5 | 6E43FE9F |
| 4.20 | subtract | 1.5 | 2.70 | 22300170 |
| 1E+90 | subtract | 1E-90 | 1.000000E+90 | 47900000 |
| -9.999999E+96 | subtract | 9.999999E+96 | -Infinity | F8000000 |
| 10 | divide | 4 | 2.5 | 22400025 |
| 130 | divide | 125 | 1.04 | 22300084 |
| 1 | divide | 3 | 0.3333333 | 2DE6CDB3 |
| 2 | divide | 7 | 0.2857143 | 29ED74C3 |
| 9.999999 | divide | 1E-95 | 9.999999E+95 | 77E3FCFF |
| 1E+90 | divide | 1E-90 | Infinity | 78000000 |

Three of these are worth pointing out. `1 - 0.9999999` needs 8 digits during the
alignment step, so an implementation that truncates to 7 too early returns 0
instead of 1E-7. `1E+90 - 1E-90` puts the operands 180 decimal places apart.
And `4.20 - 1.5` gives 2.70 rather than 2.7 because IEEE specifies a preferred
exponent for subtraction, the smaller of the two operand exponents, so the
trailing zero is meaningful.

Special cases:

| Expression | Result | Hex |
|---|---|---|
| Infinity - Infinity | NaN | 7C000000 |
| Infinity - 5 | Infinity | 78000000 |
| 5 - Infinity | -Infinity | F8000000 |
| NaN - 5 | NaN | 7C000000 |
| sNaN - 5 | NaN (quieted) | 7C000000 |
| Infinity / Infinity | NaN | 7C000000 |
| 1 / 0 | Infinity | 78000000 |
| 0 / 0 | NaN | 7C000000 |
| Infinity / 5 | Infinity | 78000000 |

## Tests

`npm run check` runs 2103 assertions:

- All 1000 possible 3 digit groups encoded to a declet and decoded back
- Declet values taken from the IEEE 754-2008 table
- Part 1 encodings, round trips, cohort behaviour, and every error path
- Part 2 rounding, including the sign traps, exact ties, and the 999 to 1000 carry
- Part 3 against the table above, plus every special case, hex operand input, and
  rejection of bad input

## Known limitation

Zero results from Part 3 always come out with exponent 0, so `5 / Infinity`
encodes as `22500000` where the standard's preferred exponent would make it
`00000000`. The value is correct either way, only the cohort member differs.

## AI Declaration

Sanidad: I used ai to help research on what I could use to start the development of the project, and I had gone to the conclusion of going to vite. I was looking for something light and not really dependent on many things but it comes at the cost of not really having much support to my knowledge since I do not know the scale of this website.

Roa: I used AI to help in formulating test cases as well as debugging the code specifically for the division operation. I opted to use gemini for that.
