import { describe, expect, it } from "vitest";

import { MESSAGES_CLE, normaliserCle } from "./cle";

const CLE = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde"; // 43 caractères base64url, jetable

describe("normaliserCle (D55, D64)", () => {
  it("accepte 43 caractères base64url", () => {
    expect(CLE).toHaveLength(43);
    expect(normaliserCle(CLE)).toEqual({ ok: true, cle: CLE });
  });

  it("retire les espaces et retours à la ligne d'un copier-coller", () => {
    expect(normaliserCle(`  ${CLE.slice(0, 20)} \n${CLE.slice(20)}  `)).toEqual({ ok: true, cle: CLE });
  });

  it("refuse une saisie vide", () => {
    expect(normaliserCle("   ")).toEqual({ ok: false, message: MESSAGES_CLE.vide });
  });

  it.each([
    ["trop courte", CLE.slice(0, 42)],
    ["trop longue", `${CLE}a`],
    ["avec du remplissage", `${CLE.slice(0, 42)}=`],
    ["en base64 classique", `${CLE.slice(0, 42)}+`],
  ])("refuse une clé %s sans la recopier", (_cas, saisie) => {
    const r = normaliserCle(saisie);
    expect(r).toEqual({ ok: false, message: MESSAGES_CLE.format });
  });
});
