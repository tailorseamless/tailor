import { z } from "zod";
import { AI_PROVIDERS } from "../../../infrastructure/ai/aiProvider";
import { paginationQuery } from "../../../shared/pagination/paginate";
import { idParams, optionalText } from "../../../shared/utils/zod";
import { AI_FEATURES, MAX_TOKEN_AMOUNT } from "../domain/aiFeatures";

export const noInputSchema = z.object({});

const provider = z.enum(AI_PROVIDERS);
const feature = z.enum(AI_FEATURES);
const model = z.string().trim().min(1, "Choose a model").max(120);
/** Hosted keys are checked for length in the service (Ollama keys may be any length, or none). */
const apiKey = z.string().trim().min(1, "Enter the API key").max(500);
const baseUrl = z.string().trim().max(300);

export const statusSchema = z.object({ query: z.object({ feature: feature.optional() }) });

export const providerParamsSchema = z.object({ params: z.object({ provider }) });

export const saveCredentialSchema = z.object({
  params: z.object({ provider }),
  body: z.object({
    /** Optional on a change: leave it out to keep the saved key and change only the model or address. */
    apiKey: apiKey.optional(),
    model,
    baseUrl: baseUrl.optional(),
    makeActive: z.boolean().optional(),
  }),
});

export const listModelsSchema = z.object({
  params: z.object({ provider }),
  body: z.object({ apiKey: apiKey.optional(), baseUrl: baseUrl.optional() }),
});

export const featureModelSchema = z.object({
  params: z.object({ feature }),
  body: z.object({ provider, model }),
});

export const featureParamsSchema = z.object({ params: z.object({ feature }) });

export const updateSettingsSchema = z.object({
  body: z.object({ startingTokens: z.number().int().min(0).max(MAX_TOKEN_AMOUNT) }),
});

export const listBalancesSchema = z.object({
  query: z.object({ ...paginationQuery, search: z.string().trim().min(1).max(100).optional() }),
});

/** Add (or, below zero, take back) a business's tokens. */
export const grantTokensSchema = z.object({
  params: idParams("businessId"),
  body: z.object({
    amount: z
      .number()
      .int()
      .min(-MAX_TOKEN_AMOUNT)
      .max(MAX_TOKEN_AMOUNT)
      .refine((value) => value !== 0, "Enter an amount other than zero"),
    note: optionalText(300),
  }),
});

export const usageSchema = z.object({
  query: z.object({ days: z.coerce.number().int().min(1).max(90).default(30) }),
});

export const testSchema = z.object({
  body: z.object({ feature: feature.optional() }),
});

export type SaveCredentialInput = z.infer<typeof saveCredentialSchema>["body"];
export type ListModelsInput = z.infer<typeof listModelsSchema>["body"];
