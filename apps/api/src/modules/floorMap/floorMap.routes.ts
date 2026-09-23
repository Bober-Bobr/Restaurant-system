import { Router } from 'express';
import { FloorMapController } from './floorMap.controller.js';

const router = Router();
const controller = new FloorMapController();

// Mounted behind requireRestaurant + requireRole in app.ts. Area DELETE is not
// here: an area is a hall, and removing one goes through DELETE /halls/:id,
// which is the one place that already decides what deleting a hall means.
router.get('/', controller.get.bind(controller));
// What is taken, and the schedule. Reads, so GET with the day in the query —
// a booking holds its tables for a whole day, and that is the unit here.
router.get('/day', controller.getDay.bind(controller));
router.get('/schedule', controller.getSchedule.bind(controller));
// The printable plan of an area for a day.
router.get('/areas/:id/print', controller.printArea.bind(controller));
router.post('/areas', controller.createArea.bind(controller));
router.patch('/areas/:id', controller.updateArea.bind(controller));
// Both POST rather than PUT/PATCH: each is an action on the area ("remember
// this", "put it back"), not a field of it somebody sends a new value for.
router.post('/areas/:id/default', controller.saveDefaultLayout.bind(controller));
router.post('/areas/:id/restore', controller.restoreDefaultLayout.bind(controller));
router.post('/tables', controller.createTable.bind(controller));
router.patch('/tables/:id', controller.updateTable.bind(controller));
router.delete('/tables/:id', controller.deleteTable.bind(controller));

export { router as floorMapRouter };
