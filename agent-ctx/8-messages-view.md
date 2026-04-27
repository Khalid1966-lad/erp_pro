# Task 8: Messages View Component

## Summary
Created `src/components/erp/messages/messages-view.tsx` — a full-page messaging interface with modern chat app UX.

## File Created
- **`src/components/erp/messages/messages-view.tsx`** (~680 lines)

## What Was Built

### Layout
- **Full-height** container (`h-[calc(100vh-8rem)]`) fitting within the ERP layout
- **Left panel** (w-80): conversation list with search, new conversation button
- **Right panel** (flex-1): active chat with messages area + input
- **Mobile responsive**: toggle between list view and chat view with back button

### Left Panel (Conversation List)
- Header with "Messages" title, conversation count, and **+** button (new conversation)
- Search input to filter conversations by name
- ScrollArea with conversation items showing:
  - Color-coded avatar with initials
  - Participant name (or group name)
  - Last message preview (truncated 40 chars) with sender prefix
  - Relative time (HH:mm, Hier, day abbreviations)
  - Unread count badge (red, destructive)
  - Active/hover states
- Skeleton loading state
- Empty state with "new conversation" CTA

### Right Panel (Active Chat)
- **Header**: avatar, participant name, online indicator, role badge, group members button
- **Messages area**: ScrollArea with:
  - Date separators (Aujourd'hui, Hier, DD/MM/YYYY)
  - Message bubbles grouped by sender
  - Own messages: right-aligned, bg-primary (colored)
  - Others' messages: left-aligned, bg-muted
  - Sender name shown for group conversations
  - Timestamps below each bubble
  - Double-check icon for sent messages
  - "Load older messages" button with pagination
  - Auto-scroll to bottom on new messages
  - Empty state when no messages
- **Input area**: 
  - Auto-resize Textarea (max 4 rows)
  - Enter to send, Shift+Enter for newline
  - Send button (disabled when empty/sending)
  - Emoji button placeholder
  - Keyboard hint text

### New Conversation Dialog
- Search input to filter users
- User list with avatar, name, email, role badge
- Select user → click "Démarrer" to create conversation
- Fetches users from `/api/users` on dialog open

### API Integration
- Uses `api` helper from `@/lib/api` (auto-includes auth token)
- `GET /api/conversations` — load conversations list
- `GET /api/conversations/[id]/messages?limit=50` — load messages
- `POST /api/conversations/[id]/messages` — send message with optimistic update
- `POST /api/conversations` — create new conversation
- `GET /api/users` — list users for new conversation dialog

### Polling
- Every 5 seconds: refresh conversations + active messages silently
- Auto-cleanup on unmount

### State Management
All state managed via `useState` + `useCallback`:
- conversations, activeConversationId, messages, users
- searchQuery, newMessage, loading, sendingMessage
- showNewConversation, selectedUserId, hasMore
- isMobile, showMobileChat (responsive)

### Helper Functions
- `getInitials(name)` — extract 1-2 letter initials
- `getAvatarColor(name)` — deterministic color from hash
- `formatDate(date)` — Aujourd'hui / Hier / DD/MM/YYYY
- `formatMessageTime(date)` — HH:mm for today, "Hier", "Day HH:mm"
- `formatConversationTime(date)` — HH:mm / Hier / Day abbrev
- `timeAgo(date)` — relative time in French
- `groupMessagesByDate(messages)` — group messages with date separators

### Notes
- Component was already wired into `page.tsx` (line 44) and `erp-layout.tsx` (ViewId type includes 'messages')
- ESLint passes with zero errors
- All shadcn/ui components used are already available in the project
