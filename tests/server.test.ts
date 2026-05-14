import { describe, expect, it } from "vitest";
import { validateHubstaffRelativePath } from "../src/server.js";

describe("validateHubstaffRelativePath", () => {
  it("allows organizations and users prefixes", () => {
    expect(validateHubstaffRelativePath("organizations/12/projects")).toBe("organizations/12/projects");
    expect(validateHubstaffRelativePath("/users/me")).toBe("users/me");
    expect(validateHubstaffRelativePath("users/99")).toBe("users/99");
  });

  it("rejects path traversal and unexpected prefixes", () => {
    expect(() => validateHubstaffRelativePath("organizations/../evil")).toThrow(/\.\./);
    expect(() => validateHubstaffRelativePath("evil")).toThrow(/organizations/);
  });
});
