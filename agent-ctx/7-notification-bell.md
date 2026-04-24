# Task 7 — Notification Bell Component

## Summary
Created `src/components/erp/notifications/notification-bell.tsx` as a 'use client' component.

## What was built
- **Notification bell button** in the ERP header with unread badge (shows "9+" if >9)
- **Bell** icon normally, **BellRing** when unread notifications exist
- **Dropdown panel** (400px wide) with:
  - Header with "Notifications" title and "Tout marquer comme lu" button
  - ScrollArea (max-h-96) with notification list
  - Each item: category/type icon (colored), title + relative time ("il y a 5 min"), message (2-line clamp), blue unread dot, hover delete button
  - Footer with "Voir tout" link (closes dropdown)
  - Empty state: bell icon + "Aucune notification"
- **Auto-fetch** on mount + every 30 seconds from `/api/notifications?limit=20`
- **Mark all as read**: PUT `/api/notifications` with `{ all: true }`
- **Mark single as read**: PUT `/api/notifications` with `{ ids: [id] }`
- **Delete**: DELETE `/api/notifications` with `{ id }`, then refetch
- **Click notification**: marks as read, navigates to `actionUrl` via `setCurrentView`, closes dropdown
- **Outside click** closes dropdown
- **Dark mode** support via Tailwind classes
- **Animations**: animate-in fade-in-0 zoom-in-95
- **timeAgo** helper function for French relative timestamps

## Icon mappings
- Type icons: info→Info, warning→AlertTriangle, error→XCircle, success→CheckCircle, task→Clock, deadline→Clock
- Category icons: order→Package, delivery→Truck, production→Factory, payment→Banknote, stock→Archive, message→MessageSquare, system→Info

## Stores used
- `useNotificationStore` (notifications, unreadCount, setNotifications, markAsRead, clearAll)
- `useNavStore` (setCurrentView for navigation on notification click)
- `useAuthStore` (token for API auth)

## Files created
- `src/components/erp/notifications/notification-bell.tsx`
