import { useAppStore } from '../store/useAppStore'
import { perm } from '../data/permissions'

/**
 * Returns helpers to check the current user's permissions.
 *
 * Usage:
 *   const { can, canAny, canAll } = usePermissions()
 *   if (can('job_orders', 'approve')) { ... }
 *   if (canAny('job_orders', 'create', 'edit')) { ... }
 */
export function usePermissions() {
  const { currentUser, rolePermissions } = useAppStore()

  const role = currentUser?.role

  /** True if the current role has the specific module.action permission */
  function can(module: string, action: string): boolean {
    if (!role) return false
    const perms = rolePermissions[role] ?? []
    return perms.includes(perm(module, action))
  }

  /** True if the current role has at least one of the given actions in the module */
  function canAny(module: string, ...actions: string[]): boolean {
    return actions.some(a => can(module, a))
  }

  /** True if the current role has ALL of the given actions in the module */
  function canAll(module: string, ...actions: string[]): boolean {
    return actions.every(a => can(module, a))
  }

  /** True if the user can view the named module (used for sidebar gating) */
  function canView(module: string): boolean {
    return can(module, 'view')
  }

  return { can, canAny, canAll, canView }
}
