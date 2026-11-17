import type { NextFunction, Request, RequestHandler, Response } from "express";
import multer from "multer";
import { AppError } from "../errors/AppError";
import { sniffMatches, typeAllowed } from "../utils/fileTypes";

const LIMIT_MESSAGES: Record<string, (field: string, maxMb: number, maxCount: number) => string> = {
  LIMIT_FILE_SIZE: (_f, maxMb) => `Each file must be ${maxMb} MB or smaller`,
  LIMIT_FILE_COUNT: (_f, _m, maxCount) => `Upload at most ${maxCount} files at a time`,
  LIMIT_UNEXPECTED_FILE: (field) => `Send the files in the "${field}" field`,
};

/**
 * Several files in one field, held in memory only (nothing touches disk).
 * Checks, in order: extension in the allowed set, MIME matches the extension,
 * size and count limits, then the bytes themselves (Backend Guide §20.4).
 * Place it AFTER authorise and BEFORE idempotent / validate.
 */
export function uploadFiles(
  field: string,
  maxCount: number,
  options: { maxMb: number; allowed: readonly string[] },
): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: options.maxMb * 1024 * 1024, files: maxCount },
    fileFilter: (_req, file, done) => {
      if (typeAllowed(file.originalname, file.mimetype, options.allowed)) return done(null, true);
      done(
        AppError.unprocessable(`Only ${options.allowed.join(", ")} files are accepted`, [
          { field, message: `${file.originalname} is not an accepted file type` },
        ]),
      );
    },
  }).array(field, maxCount);

  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        const message = LIMIT_MESSAGES[err.code]?.(field, options.maxMb, maxCount) ?? "The upload could not be read";
        return next(AppError.unprocessable(message, [{ field, message }]));
      }
      if (err) return next(err);

      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      const fake = files.find((file) => !sniffMatches(file.originalname, file.buffer));
      if (fake) {
        return next(
          AppError.unprocessable("A file's content does not match its type", [
            { field, message: `${fake.originalname} is not a real image` },
          ]),
        );
      }
      next();
    });
  };
}
