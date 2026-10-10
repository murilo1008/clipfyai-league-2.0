import { type z } from "zod";

export function schemaIssuePaths(error: z.ZodError) {
  return error.issues.map((issue) =>
    issue.path.length ? issue.path.map(String).join(".") : "<root>",
  );
}
