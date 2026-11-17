import { AppDataSource } from "../../../infrastructure/database/dataSource";

export class HealthRepository {
  static Instance = new HealthRepository();

  private constructor() {}

  async ping(): Promise<boolean> {
    try {
      if (!AppDataSource.isInitialized) return false;
      await AppDataSource.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }
}
