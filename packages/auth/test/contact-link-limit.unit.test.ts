import { describe, expect, it } from "vitest";

import {
  harness,
  held,
  policy,
  recent,
  userId,
} from "./support/contact-link-service-world.ts";

describe("asking for a link code when the account may hold no more", () => {
  it("refuses a code for one more address once the account holds as many as it may, and mails nothing", async () => {
    const { codes, repository, service } = harness({
      held: held(policy.maximumAddresses),
    });
    expect(
      await service.request({
        destination: "new@b.co",
        kind: "email",
        session: recent,
      }),
    ).toEqual({ ok: false, reason: "limit-reached" });
    expect(repository.list).toHaveBeenCalledWith(userId, "email");
    expect(codes.request).not.toHaveBeenCalled();
  });

  it("counts the address as written by the channel, so a different spelling of a held one is still that one", async () => {
    const { codes, service } = harness({ held: held(policy.maximumAddresses) });
    expect(
      await service.request({
        destination: ` ${held(1)[0]?.value.toUpperCase() ?? ""} `,
        kind: "email",
        session: recent,
      }),
    ).toEqual({ ok: true });
    expect(codes.request).toHaveBeenCalledOnce();
  });

  it("still sends a code below the limit", async () => {
    const { codes, service } = harness({
      held: held(policy.maximumAddresses - 1),
    });
    expect(
      await service.request({
        destination: "new@b.co",
        kind: "email",
        session: recent,
      }),
    ).toEqual({ ok: true });
    expect(codes.request).toHaveBeenCalledOnce();
  });

  it("leaves a request that is not an address to the code service, which says so", async () => {
    const { codes, repository, service } = harness({
      held: held(policy.maximumAddresses),
    });
    await service.request({
      destination: "nope",
      kind: "email",
      session: recent,
    });
    expect(repository.list).not.toHaveBeenCalled();
    expect(codes.request).toHaveBeenCalledOnce();
  });
});
