import { nextRouteFor, pickRole, requiredRoleFor } from "./routing";
import type { Profile } from "./types";

const p = (over: Partial<Profile>): Profile => ({ id: "u", registered: true, name: "Asha", phone: null, roles: ["student"], languageMode: "hindi", ...over });

describe("navigation after sign-in", () => {
  it("sends new users to the name screen", () => {
    expect(nextRouteFor(p({ registered: false, name: null, roles: [] }), null)).toBe("/welcome");
  });
  it("opens each role's home", () => {
    expect(nextRouteFor(p({ roles: ["student"] }), null)).toBe("/farm");
    expect(nextRouteFor(p({ roles: ["teacher"] }), null)).toBe("/teacher");
    expect(nextRouteFor(p({ roles: ["parent"] }), null)).toBe("/parent");
  });
  it("prefers the last-used role when the user still holds it", () => {
    expect(pickRole({ roles: ["student", "parent"] }, "parent")).toBe("parent");
    expect(pickRole({ roles: ["student"] }, "teacher")).toBe("student");
  });
  it("asks for a role when a registered profile has none", () => {
    expect(nextRouteFor(p({ roles: [] }), null)).toBe("/role");
  });
});

describe("role-based access", () => {
  it("maps route groups to roles", () => {
    expect(requiredRoleFor("/farm")).toBe("student");
    expect(requiredRoleFor("/teacher/students")).toBe("teacher");
    expect(requiredRoleFor("/parent")).toBe("parent");
    expect(requiredRoleFor("/login")).toBeNull();
    expect(requiredRoleFor("/farmer")).toBeNull();
  });
});
