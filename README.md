# CSARCH2 Machine 4: Decimal 32-bit Floating-Point Machine

Group 4. Web simulation of IEEE 754 decimal32 (decimal single precision, DPD encoding).

- Live site: TODO paste the deployment link here and also put it in the About / Website box of the repo
- Video walkthrough: TODO paste the youtube link here

## Running it

```
npm install
npm run dev      # local server
npm run build    # static build into dist/
npm run check    # sanity checks on the encoder
```

## What works so far

Part 1, convert decimal to decimal32. Parts 2 and 3 are stubbed out with TODO
blocks inside `src/model/rounding.js` and `src/model/arithmetic.js`.

## How the code is laid out (MVC)

```
index.html                     markup only
src/main.js                    boots the app
src/model/dpd.js               3 decimal digits <-> 10 bit declet
src/model/decimal32.js         parsing, range checking, encode, decode
src/model/rounding.js          PART 2, not built yet
src/model/arithmetic.js        PART 3, not built yet
src/view/view.js               the only file that touches the DOM
src/controller/controller.js   connects the view to the model
test/check.mjs                 encoder checks
```

Model never touches the DOM, view never does math, controller is the middleman.

## The format

```
[ 1 sign ][ 5 combination ][ 6 exponent continuation ][ 20 densely packed BCD ]
```

Precision 7 digits, bias 101, stored exponent from -101 to 90. Value is
`(-1)^sign * coefficient * 10^exponent`. The first coefficient digit is hidden
inside the combination field together with the top 2 exponent bits.

## Test cases to show in the video

| Input | Hex |
|---|---|
| 0 | 22500000 |
| 1 | 22500001 |
| -1 | A2500001 |
| 420 | 22500220 |
| 4.20 | 22300220 |
| 9999999 | 6E53FCFF |
| 1234567 x 10^56 | 45D4D2E7 |
| Infinity | 78000000 |
| -Infinity | F8000000 |
| NaN | 7C000000 |
| sNaN | 7E000000 |

Error cases to show: too many significant digits (12345678), overflow
(9 x 10^400), underflow (9 x 10^-400), garbage input (hello).

Also worth showing that 420 and 4200 x 10^-1 are the same value but different
bit patterns, that is the cohort thing and it is normal for decimal formats.


## AI Declaration

Sanidad: I used ai to help research on what I could use to start the development of the project, and I had gone to the conclusion of going to vite. I was looking for something light and not really dependent on many things but it comes at the cost of not really having much support to my knowledge since I do not know the scale of this website.