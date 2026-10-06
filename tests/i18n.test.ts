import { describe, expect, it } from "vitest";
import { translate, protectNames } from "../src/client/i18n";
import { CHANCE } from "../src/game/board";
import sl from "../src/client/locales/sl.json";
describe("Slovene localization", () => {
  it("uses economic terms with the correct meaning", () => {
    expect(translate("Royalties", "sl")).toBe("Delež najemnine");
    expect(translate("Future purchase option", "sl")).toBe("Nakupna opcija");
    expect(translate("Equity stake", "sl")).toBe("Lastniški delež");
    expect(translate("FIXED STRIKE PRICE", "sl")).toBe("FIKSNA IZVRŠILNA CENA");
  });
  it("localizes shared event messages and Slovene edition place names", () => {
    protectNames(["North", "Maja"]);
    expect(translate("North rolled 3 + 2.", "sl")).toBe("North: met 3 + 2.");
    expect(translate("Maja bought Boardwalk for $400.", "sl")).toBe(
      "Maja: nakup nepremičnine Portorož za $400.",
    );
    expect(translate("North", "sl")).toBe("North");
    expect(
      translate(
        "Maja earns a planning credit for completing lap 5 (1/3).",
        "sl",
      ),
    ).toContain("krog 5 (1/3)");
    expect(translate("Roll the dice", "en")).toBe("Roll the dice");
    expect(translate("North Carolina Avenue", "sl")).toBe("Bled");
    expect(
      translate("https://north-side.trycloudflare.com/?room=DEEDS", "sl"),
    ).toBe("https://north-side.trycloudflare.com/?room=DEEDS");
    expect(translate("Maja and North signed a deal: Roll the dice", "sl")).toBe(
      "Maja in North: sklenjen dogovor: Roll the dice",
    );
    protectNames([]);
  });
  it("uses localized property names in Slovene cards and panels", () => {
    protectNames([]);
    expect(translate("Mediterranean Avenue", "sl")).toBe("Fiesa");
    expect(translate("Baltic Avenue", "sl")).toBe("Šobec");
    expect(translate("Reading Railroad", "sl")).toBe(
      "Železniška postaja Jesenice",
    );
    expect(translate("Boardwalk", "sl")).toBe("Portorož");
    expect(translate("Boardwalk", "en")).toBe("Boardwalk");
    expect(translate(CHANCE[1].text, "sl")).toContain("Moravske toplice");
    expect(translate(CHANCE[12].text, "sl")).toContain("Železniška postaja Jesenice");
    expect(translate(CHANCE[13].text, "sl")).toContain("Portorož");
  });
  it("preserves every parameter in translated message templates", () => {
    for (const [key, value] of Object.entries(sl))
      expect((value.match(/\{\d+\}/g) || []).sort()).toEqual(
        (key.match(/\{\d+\}/g) || []).sort(),
      );
  });
});
