import { describe, expect, it } from "vitest";
import { z } from "zod";
import { schemaIssuePaths } from "./schema-issues";

describe("diagnóstico de schema do League", () => {
  it("registra só caminhos, sem valores da resposta", () => {
    const result = z
      .object({ items: z.array(z.object({ name: z.string() })) })
      .safeParse({ items: [{ name: 123 }] });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(schemaIssuePaths(result.error)).toEqual(["items.0.name"]);
  });
});
