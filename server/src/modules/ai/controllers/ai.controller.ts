import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { AiService } from "../services/ai.service";
import { AiAdminService } from "../services/aiAdmin.service";
import { AiCredentialService } from "../services/aiCredential.service";
import { RecordCaptureService } from "../services/recordCapture.service";
import {
  featureModelSchema,
  featureParamsSchema,
  grantTokensSchema,
  listBalancesSchema,
  listModelsSchema,
  noInputSchema,
  providerParamsSchema,
  saveCredentialSchema,
  statusSchema,
  testSchema,
  updateSettingsSchema,
  usageSchema,
} from "../validators/ai.schema";

/** Thin: typed input → service → envelope. */
export class AiController {
  static async status(req: Request, res: Response): Promise<void> {
    const { query } = input(req, statusSchema);
    res.json(ApiResponse.ok("AI status fetched", await AiService.Instance.status(authUser(req), query.feature)));
  }

  /** Photos or files of records → drafts to check. Saves nothing. */
  static async recordCapture(req: Request, res: Response): Promise<void> {
    input(req, noInputSchema);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    res.json(ApiResponse.ok("Records read", await RecordCaptureService.Instance.draft(authUser(req), files)));
  }

  // The platform admin's AI page.

  static async overview(_req: Request, res: Response): Promise<void> {
    res.json(ApiResponse.ok("AI settings fetched", await AiAdminService.Instance.overview()));
  }

  static async saveCredential(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, saveCredentialSchema);
    const saved = await AiCredentialService.Instance.save(authUser(req), params.provider, body);
    res.json(ApiResponse.ok("Key checked and saved", saved));
  }

  static async models(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, listModelsSchema);
    res.json(ApiResponse.ok("Models fetched", await AiCredentialService.Instance.models(params.provider, body)));
  }

  static async activate(req: Request, res: Response): Promise<void> {
    const { params } = input(req, providerParamsSchema);
    const credential = await AiCredentialService.Instance.activate(authUser(req), params.provider);
    res.json(ApiResponse.ok("Key in use", credential));
  }

  static async removeCredential(req: Request, res: Response): Promise<void> {
    const { params } = input(req, providerParamsSchema);
    await AiCredentialService.Instance.remove(authUser(req), params.provider);
    res.json(ApiResponse.ok("Key removed", null));
  }

  static async setFeatureModel(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, featureModelSchema);
    const credentials = await AiCredentialService.Instance.setFeatureModel(authUser(req), params.feature, body);
    res.json(ApiResponse.ok("Model chosen", credentials));
  }

  static async clearFeatureModel(req: Request, res: Response): Promise<void> {
    const { params } = input(req, featureParamsSchema);
    const credentials = await AiCredentialService.Instance.setFeatureModel(authUser(req), params.feature, null);
    res.json(ApiResponse.ok("Back to the key in use", credentials));
  }

  static async updateSettings(req: Request, res: Response): Promise<void> {
    const { body } = input(req, updateSettingsSchema);
    res.json(
      ApiResponse.ok(
        "AI settings saved",
        await AiAdminService.Instance.updateSettings(authUser(req), body.startingTokens),
      ),
    );
  }

  static async balances(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listBalancesSchema);
    const result = await AiAdminService.Instance.balances(query);
    res.json(ApiResponse.ok("Balances fetched", result.data, result.meta));
  }

  static async grantTokens(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, grantTokensSchema);
    const result = await AiAdminService.Instance.grant(
      authUser(req),
      params.businessId,
      body.amount,
      body.note ?? null,
    );
    res.json(ApiResponse.ok(body.amount > 0 ? "Tokens added" : "Tokens taken back", result));
  }

  static async usage(req: Request, res: Response): Promise<void> {
    const { query } = input(req, usageSchema);
    res.json(ApiResponse.ok("AI usage fetched", await AiAdminService.Instance.usageSummary(query.days)));
  }

  static async test(req: Request, res: Response): Promise<void> {
    const { body } = input(req, testSchema);
    res.json(ApiResponse.ok("The AI answered", await AiService.Instance.test(authUser(req), body.feature)));
  }
}
