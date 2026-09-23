import { describe, expect, it } from "vitest";
import { buildEndpointOptions } from "@/app/(dashboard)/dashboard/cli-tools/components/cliEndpointOptions.js";

describe("CLI endpoint defaults", () => {
  it("uses the configured base URL for the local endpoint", () => {
    const options = buildEndpointOptions({
      localUrl: "http://localhost:20127",
      requiresExternalUrl: false,
      tunnelEnabled: false,
      tunnelPublicUrl: "",
      tailscaleEnabled: false,
      tailscaleUrl: "",
      cloudEnabled: false,
      cloudUrl: "",
      savedPresets: [],
      withV1: true,
    });

    expect(options[0]).toMatchObject({
      value: "local",
      url: "http://localhost:20127/v1",
    });
  });
});
