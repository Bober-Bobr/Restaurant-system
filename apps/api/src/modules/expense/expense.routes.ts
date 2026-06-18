import { Router } from 'express';
import { ExpenseController } from './expense.controller.js';

const router = Router();
const controller = new ExpenseController();

// Export selected days' main expenses as one multi-page PDF
router.post('/pdf/selection', controller.pdfSelection.bind(controller));
// Export selected days' additional (day-level) expenses as one PDF
router.post('/pdf/extras-selection', controller.pdfExtrasSelection.bind(controller));

// Days
router.get('/days', controller.listDays.bind(controller));
router.post('/days', controller.createDay.bind(controller));
router.patch('/days/:id', controller.updateDay.bind(controller));
router.patch('/days/:id/close', controller.closeDay.bind(controller));
router.patch('/days/:id/reopen', controller.reopenDay.bind(controller));
router.delete('/days/:id', controller.removeDay.bind(controller));

// Event department booking/notes
router.patch('/events/:id', controller.updateEvent.bind(controller));

// Expense lines are created under an event department.
router.post('/events/:eventId/products', controller.addProduct.bind(controller));
router.patch('/products/:id', controller.updateProduct.bind(controller));
router.delete('/products/:id', controller.removeProduct.bind(controller));

router.post('/events/:eventId/salaries', controller.addSalary.bind(controller));
router.patch('/salaries/:id', controller.updateSalary.bind(controller));
router.delete('/salaries/:id', controller.removeSalary.bind(controller));

router.post('/events/:eventId/additionals', controller.addAdditional.bind(controller));
router.patch('/additionals/:id', controller.updateAdditional.bind(controller));
router.delete('/additionals/:id', controller.removeAdditional.bind(controller));

// Day-level additional expenses
router.post('/days/:id/extras', controller.addExtra.bind(controller));
router.patch('/extras/:id', controller.updateExtra.bind(controller));
router.delete('/extras/:id', controller.removeExtra.bind(controller));

export { router as expenseRouter };
