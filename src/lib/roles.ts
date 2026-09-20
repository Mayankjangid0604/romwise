export const ROLES = {
  USER: "user",
  ADMIN: "admin"
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export function isValidRole(role: unknown): role is Role {
  return Object.values(ROLES).includes(role as Role);
}
