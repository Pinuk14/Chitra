/**
 * Centralized Permission Manager
 * 
 * DESIGN DECISION: Permissions are defined as a configurable matrix, NOT hardcoded
 * if/else checks scattered throughout the codebase. This makes it trivial to add
 * new roles or actions without touching any component code.
 * 
 * To add a new permission:
 *   1. Add it to the `Action` type
 *   2. Add it to the ROLE_PERMISSIONS matrix
 *   That's it. No component changes needed.
 */

// All possible actions in the system
export type Action =
  | 'view_board'
  | 'draw'
  | 'erase'
  | 'delete_objects'
  | 'move_objects'
  | 'clear_board'
  | 'invite_users'
  | 'approve_users'
  | 'manage_permissions'
  | 'export_board'
  | 'send_messages'
  | 'kick_user'
  | 'ban_user'
  | 'mute_user'
  | 'manage_roles';

// All roles in the system, ordered by privilege level
export type Role = 'owner' | 'admin' | 'editor' | 'viewer';

// Human-readable labels for actions (used in UI)
export const ACTION_LABELS: Record<Action, string> = {
  view_board: 'View Board',
  draw: 'Draw',
  erase: 'Erase',
  delete_objects: 'Delete Objects',
  move_objects: 'Move Objects',
  clear_board: 'Clear Board',
  invite_users: 'Invite Users',
  approve_users: 'Approve Users',
  manage_permissions: 'Manage Permissions',
  export_board: 'Export Board',
  send_messages: 'Send Messages',
  kick_user: 'Kick User',
  ban_user: 'Ban User',
  mute_user: 'Mute User',
  manage_roles: 'Manage Roles',
};

/**
 * Role-Permission Matrix
 * 
 * Each role maps to a set of allowed actions.
 * Owner inherits all admin permissions, admin inherits all editor, etc.
 * This is the SINGLE SOURCE OF TRUTH for authorization.
 */
const ROLE_PERMISSIONS: Record<Role, Set<Action>> = {
  viewer: new Set([
    'view_board',
    'send_messages',
  ]),

  editor: new Set([
    'view_board',
    'draw',
    'erase',
    'delete_objects',
    'move_objects',
    'send_messages',
    'export_board',
  ]),

  admin: new Set([
    'view_board',
    'draw',
    'erase',
    'delete_objects',
    'move_objects',
    'clear_board',
    'send_messages',
    'export_board',
    'invite_users',
    'approve_users',
    'kick_user',
    'mute_user',
  ]),

  owner: new Set([
    'view_board',
    'draw',
    'erase',
    'delete_objects',
    'move_objects',
    'clear_board',
    'send_messages',
    'export_board',
    'invite_users',
    'approve_users',
    'manage_permissions',
    'kick_user',
    'ban_user',
    'mute_user',
    'manage_roles',
  ]),
};

/**
 * Check if a role has permission to perform an action
 */
export function hasPermission(role: Role | null | undefined, action: Action): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.has(action);
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: Role): Action[] {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return [];
  return Array.from(perms);
}

/**
 * Get the privilege level of a role (higher = more privileged)
 */
export function getRoleLevel(role: Role): number {
  const levels: Record<Role, number> = {
    viewer: 0,
    editor: 1,
    admin: 2,
    owner: 3,
  };
  return levels[role] ?? -1;
}

/**
 * Check if one role can moderate another
 * (a role can only moderate roles below it)
 */
export function canModerate(actorRole: Role, targetRole: Role): boolean {
  return getRoleLevel(actorRole) > getRoleLevel(targetRole);
}
