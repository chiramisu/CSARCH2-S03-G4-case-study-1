/*
  entry point, vite loads this from index.html and it just boots the mvc pieces
  up, keep it boring, no logic here
*/

/*
  TODO once part 2 and part 3 exist - DONE
*/

import { createView } from './view/view.js';
import { createController } from './controller/controller.js';

import { createRoundingView } from './view/roundingView.js';
import { createRoundingController } from './controller/roundingController.js';

import { createArithmeticView } from './view/arithmeticView.js';
import { createArithmeticController } from './controller/arithmeticController.js';

const view = createView();
const controller = createController(view);
controller.init();

const roundingView = createRoundingView();
const roundingController = createRoundingController(roundingView);
roundingController.init();

const arithmeticView = createArithmeticView();
const arithmeticController = createArithmeticController(arithmeticView);
arithmeticController.init();
