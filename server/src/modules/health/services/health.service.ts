import { SERVICE_NAME } from "../../../config/constants";
import { HealthRepository } from "../repositories/health.repository";

export interface HealthDTO {
  service: string;
  status: "ok" | "degraded";
  database: { ok: boolean };
  uptimeSeconds: number;
}

export class HealthService {
  static Instance = new HealthService();

  private constructor(private readonly health = HealthRepository.Instance) {}

  async check(): Promise<HealthDTO> {
    const ok = await this.health.ping();
    return {
      service: SERVICE_NAME,
      status: ok ? "ok" : "degraded",
      database: { ok },
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
