import { Router } from "express";
import { authorise } from "../../../shared/middleware/authorise.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { TaskController as T } from "../controllers/task.controller";
import * as s from "../validators/task.schema";

// No authMiddleware here — it is mounted once in app.ts (Backend Guide §14.1).
const router = Router();

router.get("/tasks", authorise("task.read"), validate(s.listTasksSchema), T.list);
router.post("/tasks", authorise("task.manage"), validate(s.createTaskSchema), T.create);
router.get("/tasks/:id", authorise("task.read"), validate(s.taskIdSchema), T.detail);
router.patch("/tasks/:id", authorise("task.manage"), validate(s.updateTaskSchema), T.update);
router.post("/tasks/:id/status", authorise("task.status"), validate(s.changeTaskStatusSchema), T.changeStatus);

export const taskRoutes = router;
