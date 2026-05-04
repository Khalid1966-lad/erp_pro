import { useAuthStore } from '@/lib/stores'

/**
 * Returns true if the current user is a super admin.
 * Super admin is the ONLY role allowed to delete records.
 */
export function useIsSuperAdmin(): boolean {
  const user = useAuthStore((s) => s.user)
  return user?.role === 'super_admin' || !!user?.isSuperAdmin
}
