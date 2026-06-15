import { Router } from 'express';
import { ExpenseController } from './expense.controller.js';

const router = Router();
const controller = new ExpenseController();

// PDF export (range ending at ?end, covering ?days)
router.get('/pdf', controller.pdf.bind(controller));

// Days
router.get('/days', controller.listDays.bind(controller));
router.post('/days', controller.createDay.bind(controller));
router.patch('/days/:id', controller.updateDay.bind(controller));
router.delete('/days/:id', controller.removeDay.bind(controller));

// Product expenses (nested under a day for creation)
router.post('/days/:dayId/products', controller.addProduct.bind(controller));
router.patch('/products/:id', controller.updateProduct.bind(controller));
router.delete('/products/:id', controller.removeProduct.bind(controller));

// Salary expenses
router.post('/days/:dayId/salaries', controller.addSalary.bind(controller));
router.patch('/salaries/:id', controller.updateSalary.bind(controller));
router.delete('/salaries/:id', controller.removeSalary.bind(controller));

export { router as expenseRouter };
