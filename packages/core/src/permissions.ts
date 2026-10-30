import type { WorkspaceRole } from '@rolodex/db'

const rank: Record<WorkspaceRole, number> = {
  viewer: 0,
  contributor: 1,
  editor: 2,
  administrator: 3,
  owner: 4,
}

export function roleAtLeast(role: WorkspaceRole, minimum: WorkspaceRole) {
  return rank[role] >= rank[minimum]
}

export function canWriteContacts(role: WorkspaceRole) {
  return roleAtLeast(role, 'editor')
}

export function canManageMembers(role: WorkspaceRole) {
  return roleAtLeast(role, 'administrator')
}
