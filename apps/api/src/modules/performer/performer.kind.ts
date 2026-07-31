import { AdminRole } from '@prisma/client';

// Performers and hosts are two roles sharing one set of tables. Everywhere the
// two are handled together, the discriminator travels as this "kind" rather
// than as a raw AdminRole, so the public API never has to speak in role names.
export type ServiceKind = 'performer' | 'host';

export const KIND_ROLE: Record<ServiceKind, AdminRole> = {
  performer: AdminRole.PERFORMER,
  host: AdminRole.HOST,
};

// Unknown or missing values fall back to 'performer', which is what every
// caller predating hosts sends — the query parameter is optional by design.
export function parseKind(value: unknown): ServiceKind {
  return value === 'host' ? 'host' : 'performer';
}

// True for the roles that own a PerformerProfile, a calendar and a booking
// inbox. Used by the auth rules, which grant hosts exactly what performers get.
export function isServiceRole(role: AdminRole): boolean {
  return role === AdminRole.PERFORMER || role === AdminRole.HOST;
}
