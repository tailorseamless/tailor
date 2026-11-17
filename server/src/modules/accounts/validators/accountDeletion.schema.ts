import { z } from "zod";
import { trimmed } from "../../../shared/utils/zod";

export const noInputSchema = z.object({});

/** The business name, typed back, so nobody deletes a business by accident. */
export const deleteBusinessSchema = z.object({ body: z.object({ confirmName: trimmed(1, 150) }) });
