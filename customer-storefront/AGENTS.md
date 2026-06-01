# Project Documentation: 1000 Мелочей (Full-Stack Retail App)

This document serves as the primary context for AI agents working on this project.

## 🛠 Tech Stack
- **Framework**: React 18 (Vite)
- **Styling**: Tailwind CSS (Utility-first)
- **Animations**: Framer Motion (`motion/react`)
- **Icons**: Lucide React
- **Runtime**: Node.js (Production start: `node server.ts` if full-stack, SPA otherwise)

## 📱 Mobile Architecture Guidelines
- **Bottom Navigation**: Stays fixed at `bottom: 0`. Any full-screen modal or Quick-View component MUST respect this space by using `bottom-[70px]` or similar padding to ensure navigation remains interactive.
- **Z-Index Layering**:
    - `z-50`: Standard overlays
    - `z-[100]`: Quick-View Backdrop
    - `z-[110]`: Mobile Bottom Navigation (Persistent)
    - `z-[150]`: Notifications Panel
    - `z-[200]`: Toast Notifications

## 🧠 Core Systems & State Logic
### 1. Review System
- **State**: `reviews: Record<number, Review[]>`
- **Logic**: Reviews are stored locally in state. The `handleAddReview` function validates input, plays a success sound, and updates the system log.

### 2. Notification Engine
- **Toasts**: Temporary popups at the top of the screen (`toasts` state).
- **Persistent Notifications**: Accessible via the Bell icon, tracking order status changes and user actions (`notifications` state).

### 3. Order Lifecycle Simulator
- **Interval**: Runs every 15 seconds.
- **Flow**: `processing` -> `shipped` -> `delivered`.
- **Integration**: Each status change triggers a toast, a sound, and a log entry.

## 🎨 Design System
- **Typography**: 
    - Display: Space Grotesk / Inter (Black weight for titles)
    - UI: Inter (Medium/SemiBold)
    - Data: JetBrains Mono
- **Themes**: Supports dynamic theme objects (`ThemeConfig`) defining background, text, and accent colors.

## 🚀 Integration Points for System Agents
- **Local Persistence**: If migrating to a real backend, replace `ordersList` and `reviews` setters with API fetchers.
- **Sound Engine**: Ensure `SoundEngine.play...()` is called on user-critical actions for "premium" feel.
- **Log System**: `systemLogs` state should be used to track background tasks (ERP syncs, AI calls) for debugging.
