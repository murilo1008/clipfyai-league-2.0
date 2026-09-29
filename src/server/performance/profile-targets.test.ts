import { Platform } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildOfficialProfileTargets } from "./profile-targets";

describe("buildOfficialProfileTargets", () => {
  it("associa handles explícitos e reutiliza o handle comum no YouTube", () => {
    expect(
      buildOfficialProfileTargets(["Instagram @talcoisa", "Tik Tok @talcoisa"]),
    ).toEqual([
      { platform: Platform.INSTAGRAM, username: "talcoisa" },
      { platform: Platform.TIKTOK, username: "talcoisa" },
      { platform: Platform.YOUTUBE, username: "talcoisa" },
    ]);
  });

  it("respeita o handle específico de cada plataforma", () => {
    expect(
      buildOfficialProfileTargets([
        "Instagram @perfil_insta",
        "Tiktok @perfil_tiktok",
        "Youtube @canal-youtube",
      ]),
    ).toEqual([
      { platform: Platform.INSTAGRAM, username: "perfil_insta" },
      { platform: Platform.TIKTOK, username: "perfil_tiktok" },
      { platform: Platform.YOUTUBE, username: "canal-youtube" },
    ]);
  });

  it("usa uma menção sem prefixo nas três redes", () => {
    expect(buildOfficialProfileTargets(["@perfil"])).toEqual([
      { platform: Platform.INSTAGRAM, username: "perfil" },
      { platform: Platform.TIKTOK, username: "perfil" },
      { platform: Platform.YOUTUBE, username: "perfil" },
    ]);
  });
});
