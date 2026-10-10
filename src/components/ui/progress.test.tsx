import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Progress } from "./progress";

describe("progresso acessível", () => {
  it("expõe percentual e nome para leitores de tela", () => {
    const markup = renderToStaticMarkup(
      <Progress value={42} aria-label="Enviando vídeo" />,
    );
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="42"');
    expect(markup).toContain('aria-valuemax="100"');
    expect(markup).toContain('aria-label="Enviando vídeo"');
  });

  it("distingue início e conclusão de progresso indeterminado", () => {
    expect(renderToStaticMarkup(<Progress value={0} />)).toContain(
      'aria-valuenow="0"',
    );
    expect(renderToStaticMarkup(<Progress value={100} />)).toContain(
      'data-state="complete"',
    );
    expect(renderToStaticMarkup(<Progress />)).not.toContain("aria-valuenow");
  });
});
