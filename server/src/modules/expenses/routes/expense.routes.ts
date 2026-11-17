import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { idempotent } from "../../../shared/middleware/idempotency.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { ExpenseController as E } from "../controllers/expense.controller";
import * as s from "../validators/expense.schema";

// No authMiddleware here — it is mounted once in app.ts (Backend Guide §14.1).
const router = Router();
const read = authorise("expense.read");
const manage = authorise("expense.manage");

router.get("/expenses", read, validate(s.listExpensesSchema), E.list);
router.post("/expenses", manage, idempotent, validate(s.createExpenseSchema), E.create);
router.get("/expenses/:id", read, validate(s.expenseIdSchema), E.detail);
router.patch("/expenses/:id", manage, validate(s.updateExpenseSchema), E.update);
router.delete("/expenses/:id", manage, validate(s.expenseIdSchema), E.remove);

export const expenseRoutes = router;
