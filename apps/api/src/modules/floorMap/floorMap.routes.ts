import { Router } from 'express';
import { FloorMapController } from './floorMap.controller.js';

const router = Router();
const controller = new FloorMapController();

// Mounted behind requireRestaurant + requireRole in app.ts. Area DELETE is not
// here: an area is a hall, and removing one goes through DELETE /halls/:id,
// which is the one place that already decides what deleting a hall means.
router.get('/', controller.get.bind(controller));
router.post('/areas', controller.createArea.bind(controller));
router.patch('/areas/:id', controller.updateArea.bind(controller));
router.post('/tables', controller.createTable.bind(controller));
router.patch('/tables/:id', controller.updateTable.bind(controller));
router.delete('/tables/:id', controller.deleteTable.bind(controller));

export { router as floorMapRouter };
