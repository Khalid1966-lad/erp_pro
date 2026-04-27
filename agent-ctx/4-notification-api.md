---
Task ID: 4
Agent: Main Agent
Task: Create notification API routes

Work Log:
- Created `src/app/api/notifications/route.ts` with 4 HTTP methods:
  - **GET /api/notifications**: List notifications for authenticated user with pagination (limit, offset), unreadOnly filter, category filter. Returns notifications array + unreadCount + total. Ordered by createdAt desc.
  - **POST /api/notifications**: Create notification (admin/super_admin only). Supports single user (userId required) or broadcast mode (broadcast=true sends to all active users). Validates title, message, type, category. Verifies target user exists.
  - **PUT /api/notifications**: Mark as read. Supports { ids: string[] } for specific notifications or { all: true } for all unread. Only operates on authenticated user's own notifications.
  - **DELETE /api/notifications**: Delete own notification by id. Verifies ownership before deleting.
- Follows existing patterns: requireAuth, NextResponse, Prisma types, French error messages
- Lint: 0 errors

Stage Summary:
- Complete notification API with CRUD + bulk mark-as-read + broadcast
- All endpoints authenticated, POST restricted to admin/super_admin
- DELETE/PUT scoped to user's own notifications only
