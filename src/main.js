/*
  entry point, vite loads this from index.html and it just boots the mvc pieces
  up, keep it boring, no logic here
*/

import { createView } from './view/view.js';
import { createController } from './controller/controller.js';

const view = createView();
const controller = createController(view);
controller.init();

/*
  TODO once part 2 and part 3 exist, boot them here the same way

  import { createRoundingView } from './view/roundingView.js';
  import { createRoundingController } from './controller/roundingController.js';
  createRoundingController(createRoundingView()).init();
*/
