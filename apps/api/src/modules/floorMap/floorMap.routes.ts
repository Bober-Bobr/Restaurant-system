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
// An action on the area ("give it a layout of its own on this day"), not a
// field of it — the booking wizard calls it before its first change to a day.
router.post('/areas/:id/day-layout', controller.forkDay.bind(controller));
router.post('/tables', controller.createTable.bind(controller));
// Before the :id routes in spirit though not in need (different method): an
// action on several tables at once, not a field of one of them.
router.post('/tables/merge', controller.mergeTables.bind(controller));
router.patch('/tables/:id', controller.updateTable.bind(controller));
router.delete('/tables/:id', controller.deleteTable.bind(controller));

export { router as floorMapRouter };
