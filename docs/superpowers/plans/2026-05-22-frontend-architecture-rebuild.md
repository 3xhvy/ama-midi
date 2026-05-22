# Frontend Architecture Rebuild — Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the AMA-MIDI frontend with a component-driven architecture: reusable UI primitives (Radix + Tailwind), theme-aware layout shells, Design.md-compliant editor components, and responsive design.

**Architecture:** 4-layer system (Lib → UI → Features → Pages). Variant-driven primitives with Radix for accessibility. Theme via CSS variables + `.dark` class. EditorShell handles responsive panel collapse internally. Existing hooks/stores/API untouched until Task 8 (store extension only — no rewrite).

**Tech Stack:** React 18, Radix UI (dialog, tabs, tooltip, toggle-group), Tailwind CSS 3, Zustand, TanStack Query, clsx + tailwind-merge

**Spec:** `docs/superpowers/specs/2026-05-22-frontend-architecture-design.md`

**v2 Changes from original plan:**
- Task 2: CSS tokens are ADDITIVE — new `--shell-*`/`--canvas-*` aliases point to existing vars. Nothing removed or renamed. Old components keep working.
- Task 7: `GridLines` receives `virtualItems` from PianoRoll's existing virtualizer — no plain loop that renders 300+ divs.
- Task 7: `NoteCircle` imports from `engine/index.ts` barrel, not individual files.
- Task 8: `editor.store.ts` is EXTENDED (new fields appended) — not rewritten. Existing consumers unaffected.
- Task 9: `NoteBlock.tsx` NOT deleted here.
- Task 10: PianoRoll rewrite AND `rm NoteBlock.tsx` happen together — no broken-build gap.

---

## File Map

### New Files
```
src/lib/utils.ts
src/lib/constants.ts
src/store/theme.store.ts
src/hooks/useMediaQuery.ts
src/hooks/useKeyboardShortcuts.ts
src/components/ui/Button.tsx
src/components/ui/Badge.tsx
src/components/ui/Avatar.tsx
src/components/ui/AvatarStack.tsx
src/components/ui/Input.tsx
src/components/ui/Textarea.tsx
src/components/ui/Modal.tsx
src/components/ui/Tabs.tsx
src/components/ui/Tooltip.tsx
src/components/ui/ToggleGroup.tsx
src/components/ui/ColorPicker.tsx
src/components/ui/Skeleton.tsx
src/components/ui/IconButton.tsx
src/components/ui/StatusBadge.tsx
src/components/ui/index.ts
src/components/layout/AppShell.tsx
src/components/layout/EditorShell.tsx
src/components/layout/index.ts
src/features/editor/components/NoteCircle.tsx
src/features/editor/components/GhostCircle.tsx
src/features/editor/components/NoteTooltip.tsx
src/features/editor/components/TrackHeader.tsx
src/features/editor/components/TimeAxis.tsx
src/features/editor/components/Playhead.tsx
src/features/editor/components/GridLines.tsx
src/features/songs/SongCard.tsx
src/features/songs/SongGrid.tsx
```

### Modified Files
```
src/styles/globals.css           — ADD new alias tokens only (no removal)
apps/web/tailwind.config.js      — ADD shell.* + canvas.* color groups (no removal)
apps/web/package.json            — add Radix + clsx + tailwind-merge
src/store/editor.store.ts        — EXTEND with new fields (append only)
src/features/editor/components/PianoRoll.tsx  — rewrite to use new sub-components
src/features/editor/components/AiSuggestions.tsx — circle shapes
src/features/editor/components/NotePopup.tsx  — use Modal primitive
src/pages/EditorPage.tsx         — compose via EditorShell
src/pages/SongListPage.tsx       — compose via AppShell + SongGrid
src/pages/LoginPage.tsx          — compose via AppShell
src/App.tsx                      — add theme store initialization
```

### Deleted Files (Task 10 only — after PianoRoll no longer imports it)
```
src/features/editor/components/NoteBlock.tsx
```

---

## Task 1: Install Dependencies + Utility Foundation

**Files:**
- Modify: `apps/web/package.json`
- Create: `src/lib/utils.ts`
- Create: `src/lib/constants.ts`

- [ ] **Step 1: Install Radix + utility packages**

```bash
cd apps/web && pnpm add @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-toggle-group clsx tailwind-merge
```

- [ ] **Step 2: Create `src/lib/utils.ts`**

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`
}

export function getColorFromName(name: string): string {
  const colors = ['#6C63FF', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#8B5CF6', '#3B82F6']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}
```

- [ ] **Step 3: Create `src/lib/constants.ts`**

```typescript
export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1280,
} as const

export const PANEL_WIDTHS = {
  left: 240,
  leftCollapsed: 48,
  right: 280,
  historyOverlay: 320,
} as const

export const TOPBAR_HEIGHT = 64
export const BOTTOMBAR_HEIGHT = 48
export const TRACK_HEADER_HEIGHT = 40
export const TIME_AXIS_WIDTH = 40
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add Radix UI deps + lib utilities (cn, constants)"
```

---

## Task 2: Theme System — Additive CSS Tokens + Store + Responsive Hooks

> **Key rule:** ONLY add new tokens. Never rename or remove `--color-editor-*`, `--color-bg`, `--color-surface`, `--color-border`, `--color-text-*`. Old components keep working unchanged.

**Files:**
- Modify: `src/styles/globals.css`
- Modify: `apps/web/tailwind.config.js`
- Create: `src/store/theme.store.ts`
- Create: `src/hooks/useMediaQuery.ts`

- [ ] **Step 1: Append alias tokens to `src/styles/globals.css`**

Add these lines inside `:root {}` after the existing vars. Do NOT remove anything.

```css
/* Shell tokens — alias to existing light-zone vars */
--shell-bg: var(--color-bg);
--shell-surface: var(--color-surface);
--shell-border: var(--color-border);
--shell-text: var(--color-text-primary);
--shell-muted: var(--color-text-secondary);
--shell-tertiary: var(--color-text-tertiary);

/* Canvas tokens — alias to existing editor dark-zone vars */
--canvas-bg: var(--color-editor-bg);
--canvas-surface: var(--color-editor-surface);
--canvas-border: var(--color-editor-border);
--canvas-text: var(--color-editor-text);
--canvas-muted: var(--color-editor-muted);
--canvas-grid: var(--color-grid-line);
--canvas-grid-bold: var(--color-grid-line-bold);
```

Also add `.dark` block for light-mode shell (only applies when dark mode toggle is used — no effect until ThemeStore activates it):

```css
.dark {
  --shell-bg: #13111E;
  --shell-surface: #1E1B2E;
  --shell-border: #2D2847;
  --shell-text: #E2DEFF;
  --shell-muted: #6B6585;
  --shell-tertiary: #4A4560;
}
```

Also add animation utility class (already have `.note-circle`/`.note-ghost` — add):

```css
.animate-note-appear  { animation: note-appear 150ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.animate-ghost-pulse  { animation: ghost-pulse 1.5s ease-in-out infinite; }
.animate-slide-in-right { animation: slide-in-right 250ms ease; }
```

- [ ] **Step 2: Add `shell` + `canvas` color groups to `apps/web/tailwind.config.js`**

Add inside `theme.extend.colors` — do NOT remove existing `editor`, `bg`, `surface`, `border`, `text` groups:

```javascript
shell: {
  bg:       'var(--shell-bg)',
  surface:  'var(--shell-surface)',
  border:   'var(--shell-border)',
  text:     'var(--shell-text)',
  muted:    'var(--shell-muted)',
  tertiary: 'var(--shell-tertiary)',
},
canvas: {
  bg:      'var(--canvas-bg)',
  surface: 'var(--canvas-surface)',
  border:  'var(--canvas-border)',
  text:    'var(--canvas-text)',
  muted:   'var(--canvas-muted)',
},
```

- [ ] **Step 3: Create `src/store/theme.store.ts`**

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ThemeMode = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

interface ThemeStore {
  mode: ThemeMode
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement
  if (resolved === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      mode: 'dark',
      resolved: 'dark',
      setMode: (mode) => {
        const resolved = mode === 'system' ? getSystemTheme() : mode
        applyTheme(resolved)
        set({ mode, resolved })
      },
    }),
    {
      name: 'ama-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = state.mode === 'system' ? getSystemTheme() : state.mode
          applyTheme(resolved)
          state.resolved = resolved
        }
      },
    },
  ),
)

if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { mode, setMode } = useThemeStore.getState()
    if (mode === 'system') setMode('system')
  })
}
```

- [ ] **Step 4: Create `src/hooks/useMediaQuery.ts`**

```typescript
import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    setMatches(mql.matches)
    return () => mql.removeEventListener('change', handler)
  }, [query])
  return matches
}

export function useIsMobile() { return useMediaQuery('(max-width: 767px)') }
export function useIsTablet() { return useMediaQuery('(min-width: 768px) and (max-width: 1279px)') }
export function useIsDesktop() { return useMediaQuery('(min-width: 1280px)') }
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: additive theme tokens (shell/canvas aliases) + ThemeStore + responsive hooks"
```

---

## Task 3: UI Primitives — Button, Badge, StatusBadge, IconButton

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/ui/StatusBadge.tsx`
- Create: `src/components/ui/IconButton.tsx`

- [ ] **Step 1: Create `src/components/ui/Button.tsx`**

```typescript
import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

const variants = {
  primary:   'bg-primary text-white hover:bg-primary-dark',
  secondary: 'bg-shell-surface text-shell-text border border-shell-border hover:bg-shell-bg',
  ghost:     'text-shell-muted hover:text-shell-text hover:bg-shell-bg',
  danger:    'bg-error/10 text-error hover:bg-error/20 border border-error/30',
} as const

const sizes = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
} as const

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  rounded?: boolean
  loading?: boolean
  icon?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', rounded, loading, icon, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        rounded ? 'rounded-full' : 'rounded-md',
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
```

- [ ] **Step 2: Create `src/components/ui/Badge.tsx`**

```typescript
import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

const variants = {
  default: 'bg-shell-bg text-shell-text border border-shell-border',
  success: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  error:   'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  muted:   'bg-shell-bg text-shell-muted',
} as const

const sizes = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
} as const

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  icon?: React.ReactNode
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', icon, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  ),
)
Badge.displayName = 'Badge'
```

- [ ] **Step 3: Create `src/components/ui/StatusBadge.tsx`**

```typescript
import { STATUS_COLORS } from '@ama-midi/shared'
import { Badge } from './Badge'

type Status = keyof typeof STATUS_COLORS

const icons: Record<Status, string> = {
  synced:      '✓',
  needsReview: '⚠',
  outdated:    '✕',
  draft:       '○',
}

const badgeVariants: Record<Status, 'success' | 'warning' | 'error' | 'muted'> = {
  synced:      'success',
  needsReview: 'warning',
  outdated:    'error',
  draft:       'muted',
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <Badge variant={badgeVariants[status]} size="sm" icon={<span>{icons[status]}</span>} className={className}>
      {STATUS_COLORS[status].label}
    </Badge>
  )
}
```

- [ ] **Step 4: Create `src/components/ui/IconButton.tsx`**

```typescript
import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

const variants = {
  ghost:    'text-shell-muted hover:text-shell-text hover:bg-shell-bg',
  outlined: 'text-shell-muted hover:text-shell-text border border-shell-border hover:bg-shell-bg',
} as const

const sizes = {
  sm: 'w-7 h-7 text-sm',
  md: 'w-8 h-8 text-base',
} as const

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  tooltip?: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'ghost', size = 'md', tooltip, children, ...props }, ref) => (
    <button
      ref={ref}
      title={tooltip}
      className={cn(
        'inline-flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
)
IconButton.displayName = 'IconButton'
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: UI primitives — Button, Badge, StatusBadge, IconButton"
```

---

## Task 4: UI Primitives — Avatar, AvatarStack, Input, Textarea, ColorPicker, Skeleton

- [ ] **Step 1: Create `src/components/ui/Avatar.tsx`**

```typescript
import { forwardRef } from 'react'
import { cn, getInitials, getColorFromName } from '../../lib/utils'

const sizeMap     = { xs: 24, sm: 32, md: 40, lg: 48 } as const
const textSizeMap = { xs: 'text-[9px]', sm: 'text-xs', md: 'text-sm', lg: 'text-base' } as const

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  name: string
  size?: keyof typeof sizeMap
  showOnline?: boolean
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, name, size = 'md', showOnline, ...props }, ref) => {
    const px = sizeMap[size]
    return (
      <div
        ref={ref}
        className={cn('relative inline-flex items-center justify-center rounded-full overflow-hidden shrink-0', className)}
        style={{ width: px, height: px, backgroundColor: getColorFromName(name) }}
        title={name}
        {...props}
      >
        {src ? (
          <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className={cn('font-medium text-white select-none', textSizeMap[size])}>
            {getInitials(name)}
          </span>
        )}
        {showOnline && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-shell-surface rounded-full" />
        )}
      </div>
    )
  },
)
Avatar.displayName = 'Avatar'
```

- [ ] **Step 2: Create `src/components/ui/AvatarStack.tsx`**

```typescript
import { Avatar, type AvatarProps } from './Avatar'
import { cn } from '../../lib/utils'

export interface AvatarStackProps {
  users: { id: string; name: string; avatarUrl?: string }[]
  max?: number
  size?: AvatarProps['size']
  className?: string
}

export function AvatarStack({ users, max = 5, size = 'sm', className }: AvatarStackProps) {
  const visible  = users.slice(0, max)
  const overflow = users.length - visible.length
  return (
    <div className={cn('flex items-center', className)}>
      {visible.map((user, i) => (
        <div
          key={user.id}
          className="border-2 border-shell-surface rounded-full"
          style={{ marginLeft: i > 0 ? -8 : 0, zIndex: visible.length - i, position: 'relative' }}
        >
          <Avatar src={user.avatarUrl} name={user.name} size={size} showOnline />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="flex items-center justify-center rounded-full bg-shell-bg border border-shell-border text-xs text-shell-muted font-medium"
          style={{ width: size === 'sm' ? 32 : 40, height: size === 'sm' ? 32 : 40, marginLeft: -8, position: 'relative', zIndex: 0 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/ui/Input.tsx`**

```typescript
import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

const sizes = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3 py-2 text-sm',
} as const

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  size?: keyof typeof sizes
  error?: string
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, size = 'md', error, icon, ...props }, ref) => (
    <div className="relative">
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-shell-muted">{icon}</span>}
      <input
        ref={ref}
        className={cn(
          'w-full border rounded-lg bg-shell-surface text-shell-text placeholder-shell-tertiary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30',
          error ? 'border-error' : 'border-shell-border',
          icon ? 'pl-9' : '',
          sizes[size],
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  ),
)
Input.displayName = 'Input'
```

- [ ] **Step 4: Create `src/components/ui/Textarea.tsx`**

```typescript
import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <div>
      <textarea
        ref={ref}
        className={cn(
          'w-full px-3 py-2 text-sm border rounded-lg bg-shell-surface text-shell-text placeholder-shell-tertiary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none',
          error ? 'border-error' : 'border-shell-border',
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  ),
)
Textarea.displayName = 'Textarea'
```

- [ ] **Step 5: Create `src/components/ui/ColorPicker.tsx`**

```typescript
import { cn } from '../../lib/utils'

export interface ColorPickerProps {
  colors: readonly string[]
  value: string
  onChange: (color: string) => void
  className?: string
}

export function ColorPicker({ colors, value, onChange, className }: ColorPickerProps) {
  return (
    <div className={cn('flex gap-2 flex-wrap', className)}>
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            'w-6 h-6 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            value === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105',
          )}
          style={{ backgroundColor: color }}
          aria-label={`Color ${color}`}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Create `src/components/ui/Skeleton.tsx`**

```typescript
import { cn } from '../../lib/utils'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number
  height?: string | number
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

export function Skeleton({ className, width, height, rounded = 'md', style, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse bg-shell-border', `rounded-${rounded}`, className)}
      style={{ width, height, ...style }}
      {...props}
    />
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: UI primitives — Avatar, AvatarStack, Input, Textarea, ColorPicker, Skeleton"
```

---

## Task 5: UI Primitives — Modal, Tabs, Tooltip, ToggleGroup (Radix) + barrel

- [ ] **Step 1: Create `src/components/ui/Modal.tsx`**

```typescript
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '../../lib/utils'

function Root({ children, ...props }: Dialog.DialogProps) {
  return <Dialog.Root {...props}>{children}</Dialog.Root>
}

function Trigger({ children, ...props }: Dialog.DialogTriggerProps) {
  return <Dialog.Trigger asChild {...props}>{children}</Dialog.Trigger>
}

function Content({ children, className, ...props }: Dialog.DialogContentProps) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-[rgba(26,22,53,0.6)] z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <Dialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[400px] bg-shell-surface rounded-xl shadow-lg p-0 focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  )
}

function Header({ children, className, onClose }: { children: React.ReactNode; className?: string; onClose?: () => void }) {
  return (
    <div className={cn('flex items-center justify-between px-6 py-4 border-b border-shell-border', className)}>
      <Dialog.Title className="font-semibold text-shell-text text-sm">{children}</Dialog.Title>
      {onClose && (
        <Dialog.Close asChild>
          <button className="text-shell-muted hover:text-shell-text text-xl leading-none" onClick={onClose}>×</button>
        </Dialog.Close>
      )}
    </div>
  )
}

function Body({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-6 py-4', className)}>{children}</div>
}

function Footer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-end gap-2 px-6 py-4 border-t border-shell-border', className)}>
      {children}
    </div>
  )
}

export const Modal = { Root, Trigger, Content, Header, Body, Footer, Close: Dialog.Close }
```

- [ ] **Step 2: Create `src/components/ui/Tabs.tsx`**

```typescript
import * as RadixTabs from '@radix-ui/react-tabs'
import { cn } from '../../lib/utils'

function Root({ children, ...props }: RadixTabs.TabsProps) {
  return <RadixTabs.Root {...props}>{children}</RadixTabs.Root>
}

function List({ children, className, ...props }: RadixTabs.TabsListProps) {
  return (
    <RadixTabs.List className={cn('flex border-b border-shell-border shrink-0', className)} {...props}>
      {children}
    </RadixTabs.List>
  )
}

function Trigger({ children, className, ...props }: RadixTabs.TabsTriggerProps) {
  return (
    <RadixTabs.Trigger
      className={cn(
        'flex-1 py-2.5 text-xs font-medium capitalize transition-colors text-shell-muted hover:text-shell-text data-[state=active]:text-shell-text data-[state=active]:border-b-2 data-[state=active]:border-primary',
        className,
      )}
      {...props}
    >
      {children}
    </RadixTabs.Trigger>
  )
}

function Content({ children, className, ...props }: RadixTabs.TabsContentProps) {
  return (
    <RadixTabs.Content className={cn('flex-1 overflow-hidden flex flex-col', className)} {...props}>
      {children}
    </RadixTabs.Content>
  )
}

export const Tabs = { Root, List, Trigger, Content }
```

- [ ] **Step 3: Create `src/components/ui/Tooltip.tsx`**

```typescript
import * as RadixTooltip from '@radix-ui/react-tooltip'
import { cn } from '../../lib/utils'

export interface TooltipProps {
  content: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: React.ReactNode
  className?: string
}

export function Tooltip({ content, side = 'top', children, className }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={300}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={4}
            className={cn(
              'z-50 px-3 py-1.5 text-xs bg-shell-surface text-shell-text border border-shell-border rounded-lg shadow-md animate-in fade-in-0 zoom-in-95',
              className,
            )}
          >
            {content}
            <RadixTooltip.Arrow className="fill-shell-border" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  )
}
```

- [ ] **Step 4: Create `src/components/ui/ToggleGroup.tsx`**

```typescript
import * as RadixToggleGroup from '@radix-ui/react-toggle-group'
import { cn } from '../../lib/utils'

export interface ToggleGroupProps {
  items: { value: string; label: string }[]
  value: string
  onValueChange: (value: string) => void
  variant?: 'default' | 'canvas'
  className?: string
}

export function ToggleGroup({ items, value, onValueChange, variant = 'default', className }: ToggleGroupProps) {
  const bgClass      = variant === 'canvas' ? 'bg-canvas-bg border-canvas-border' : 'bg-shell-bg border-shell-border'
  const itemInactive = variant === 'canvas' ? 'text-canvas-muted hover:text-canvas-text' : 'text-shell-muted hover:text-shell-text'

  return (
    <RadixToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v)}
      className={cn('flex rounded-md overflow-hidden border', bgClass, className)}
    >
      {items.map((item) => (
        <RadixToggleGroup.Item
          key={item.value}
          value={item.value}
          className={cn(
            'px-3 py-1 text-xs font-medium transition-colors',
            value === item.value ? 'bg-primary text-white' : itemInactive,
          )}
        >
          {item.label}
        </RadixToggleGroup.Item>
      ))}
    </RadixToggleGroup.Root>
  )
}
```

- [ ] **Step 5: Create `src/components/ui/index.ts`**

```typescript
export { Button,      type ButtonProps      } from './Button'
export { Badge,       type BadgeProps       } from './Badge'
export { StatusBadge                        } from './StatusBadge'
export { IconButton,  type IconButtonProps  } from './IconButton'
export { Avatar,      type AvatarProps      } from './Avatar'
export { AvatarStack, type AvatarStackProps } from './AvatarStack'
export { Input,       type InputProps       } from './Input'
export { Textarea,    type TextareaProps    } from './Textarea'
export { ColorPicker, type ColorPickerProps } from './ColorPicker'
export { Skeleton,    type SkeletonProps    } from './Skeleton'
export { Modal                              } from './Modal'
export { Tabs                               } from './Tabs'
export { Tooltip,     type TooltipProps     } from './Tooltip'
export { ToggleGroup, type ToggleGroupProps } from './ToggleGroup'
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: UI primitives — Modal, Tabs, Tooltip, ToggleGroup (Radix) + barrel"
```

---

## Task 6: Layout Shells — EditorShell + AppShell

- [ ] **Step 1: Create `src/components/layout/EditorShell.tsx`**

```typescript
import { cn } from '../../lib/utils'
import { useIsMobile, useIsTablet } from '../../hooks/useMediaQuery'
import { TOPBAR_HEIGHT, BOTTOMBAR_HEIGHT, PANEL_WIDTHS } from '../../lib/constants'

export interface EditorShellProps {
  topBar:         React.ReactNode
  leftPanel:      React.ReactNode
  rightPanel:     React.ReactNode
  bottomBar:      React.ReactNode
  children:       React.ReactNode
  leftCollapsed?: boolean
  rightCollapsed?: boolean
  onLeftToggle?:  () => void
  onRightToggle?: () => void
}

export function EditorShell({
  topBar, leftPanel, rightPanel, bottomBar, children,
  leftCollapsed = false, rightCollapsed = false,
  onLeftToggle, onRightToggle,
}: EditorShellProps) {
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()

  const showLeftInline  = !isMobile && !leftCollapsed
  const showRightInline = !isMobile && !isTablet && !rightCollapsed

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-shell-bg">
      <header className="shrink-0 flex items-center border-b border-shell-border bg-shell-surface px-4" style={{ height: TOPBAR_HEIGHT }}>
        {topBar}
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {showLeftInline && (
          <aside className="shrink-0 border-r border-shell-border bg-shell-surface overflow-y-auto transition-all duration-[250ms]" style={{ width: PANEL_WIDTHS.left }}>
            {leftPanel}
          </aside>
        )}

        <main className="flex-1 overflow-hidden bg-canvas-bg">
          {children}
        </main>

        {showRightInline && (
          <aside className="shrink-0 border-l border-shell-border bg-shell-surface overflow-y-auto transition-all duration-[250ms]" style={{ width: PANEL_WIDTHS.right }}>
            {rightPanel}
          </aside>
        )}

        {isTablet && !rightCollapsed && (
          <aside className="absolute top-0 right-0 h-full border-l border-shell-border bg-shell-surface overflow-y-auto shadow-lg z-40 animate-slide-in-right" style={{ width: PANEL_WIDTHS.right }}>
            {rightPanel}
          </aside>
        )}

        {isMobile && !leftCollapsed && (
          <div className="absolute inset-0 z-40 flex">
            <aside className="w-[280px] h-full bg-shell-surface border-r border-shell-border overflow-y-auto shadow-lg animate-slide-in-right">
              {leftPanel}
            </aside>
            <div className="flex-1 bg-black/30" onClick={onLeftToggle} />
          </div>
        )}
        {isMobile && !rightCollapsed && (
          <div className="absolute inset-0 z-40 flex justify-end">
            <div className="flex-1 bg-black/30" onClick={onRightToggle} />
            <aside className="w-[280px] h-full bg-shell-surface border-l border-shell-border overflow-y-auto shadow-lg animate-slide-in-right">
              {rightPanel}
            </aside>
          </div>
        )}
      </div>

      <footer className="shrink-0 flex items-center border-t border-shell-border bg-shell-surface px-4" style={{ height: BOTTOMBAR_HEIGHT }}>
        {bottomBar}
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/layout/AppShell.tsx`**

```typescript
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../store/auth.store'
import { Avatar } from '../ui/Avatar'

export interface AppShellProps {
  children: React.ReactNode
  maxWidth?: string
  showHeader?: boolean
  className?: string
}

export function AppShell({ children, maxWidth = '1100px', showHeader = true, className }: AppShellProps) {
  const user      = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  return (
    <div className={cn('min-h-screen bg-shell-bg', className)}>
      {showHeader && (
        <header className="h-16 border-b border-shell-border bg-shell-surface flex items-center px-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-amanotes-pink to-amanotes-purple" />
            <span className="font-semibold text-shell-text">AMA-MIDI</span>
          </div>
          {user && (
            <div className="ml-auto flex items-center gap-3">
              <Avatar src={user.avatarUrl} name={user.name} size="sm" />
              <button onClick={clearAuth} className="text-xs text-shell-muted hover:text-shell-text">
                Sign out
              </button>
            </div>
          )}
        </header>
      )}
      <main className="mx-auto px-4 py-8" style={{ maxWidth }}>
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/layout/index.ts`**

```typescript
export { EditorShell, type EditorShellProps } from './EditorShell'
export { AppShell,    type AppShellProps    } from './AppShell'
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: layout shells — EditorShell (5-zone responsive) + AppShell"
```

---

## Task 7: Editor Sub-Components

> **GridLines rule:** receives `virtualItems` from PianoRoll's existing `@tanstack/react-virtual` virtualizer. Never renders a plain `for` loop over 300+ time positions — that destroys the virtualization Block 19 depends on.
>
> **Import rule:** `NoteCircle` and all editor sub-components import from `engine/index.ts` barrel (`../engine`), not individual files.

**Files:**
- Create: `src/features/editor/components/NoteCircle.tsx`
- Create: `src/features/editor/components/GhostCircle.tsx`
- Create: `src/features/editor/components/NoteTooltip.tsx`
- Create: `src/features/editor/components/TrackHeader.tsx`
- Create: `src/features/editor/components/TimeAxis.tsx`
- Create: `src/features/editor/components/Playhead.tsx`
- Create: `src/features/editor/components/GridLines.tsx`

- [ ] **Step 1: Create `src/features/editor/components/NoteCircle.tsx`**

Drop-in replacement for `NoteBlock`. Same QA flag logic, same view mode behavior. Shape changes to circle.

```typescript
import { useState } from 'react'
import { cn } from '../../../lib/utils'
import { trackToX, timeToY, trackWidth } from '../engine'
import { NoteTooltip } from './NoteTooltip'
import type { Note } from '@ama-midi/shared'

export interface NoteCircleProps {
  note:       Note
  gridWidth:  number
  pxPerSecond: number
  isSelected?: boolean
  viewMode?:  'composer' | 'developer' | 'qa'
  allNotes?:  Note[]
  onClick:    (note: Note, e: React.MouseEvent) => void
}

export function NoteCircle({
  note, gridWidth, pxPerSecond,
  isSelected = false, viewMode = 'composer', allNotes = [], onClick,
}: NoteCircleProps) {
  const [hovered, setHovered] = useState(false)

  const x  = trackToX(note.track, gridWidth)
  const y  = timeToY(note.time, pxPerSecond)
  const tw = trackWidth(gridWidth)
  const cx = x + tw / 2
  const cy = y

  const isNearBoundary   = note.time < 0.5 || note.time > 299.5
  const hasCloseNeighbor = allNotes.some(
    (n) => n.id !== note.id && n.track === note.track && Math.abs(n.time - note.time) < 0.3,
  )

  const ringClass =
    viewMode === 'qa'
      ? isNearBoundary
        ? 'ring-2 ring-orange-400'
        : hasCloseNeighbor
          ? 'ring-2 ring-yellow-400'
          : ''
      : isSelected
        ? 'ring-2 ring-white'
        : ''

  const displayTime = viewMode === 'developer' ? note.time : Math.round(note.time * 10) / 10

  return (
    <>
      <div
        className={cn(
          'absolute w-4 h-4 rounded-full cursor-pointer hover:scale-125 transition-transform animate-note-appear group',
          ringClass,
        )}
        style={{ left: cx - 8, top: cy - 8, backgroundColor: note.color }}
        title={`${note.title} | Track ${note.track} | ${displayTime}s`}
        onClick={(e) => onClick(note, e)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {viewMode === 'developer' && (
          <div className="absolute top-0 left-0 text-[8px] font-mono text-white/90 whitespace-nowrap bg-black/50 px-0.5 rounded leading-none pointer-events-none select-none opacity-0 group-hover:opacity-100">
            {note.id.slice(0, 8)}
          </div>
        )}
      </div>
      {hovered && <NoteTooltip note={note} position={{ x: cx, y: cy - 24 }} />}
    </>
  )
}
```

- [ ] **Step 2: Create `src/features/editor/components/GhostCircle.tsx`**

```typescript
import { trackToX, timeToY, trackWidth } from '../engine'

export interface GhostCircleProps {
  track:       number
  time:        number
  gridWidth:   number
  pxPerSecond: number
}

export function GhostCircle({ track, time, gridWidth, pxPerSecond }: GhostCircleProps) {
  const x  = trackToX(track, gridWidth)
  const y  = timeToY(time, pxPerSecond)
  const tw = trackWidth(gridWidth)
  return (
    <div
      className="absolute w-4 h-4 rounded-full border-2 border-white/50 bg-white/20 pointer-events-none"
      style={{ left: x + tw / 2 - 8, top: y - 8 }}
    />
  )
}
```

- [ ] **Step 3: Create `src/features/editor/components/NoteTooltip.tsx`**

```typescript
import { Avatar } from '../../../components/ui'
import { formatTime } from '../../../lib/utils'
import type { Note } from '@ama-midi/shared'

export interface NoteTooltipProps {
  note:     Note
  position: { x: number; y: number }
}

export function NoteTooltip({ note, position }: NoteTooltipProps) {
  return (
    <div
      className="absolute z-50 bg-shell-surface border border-shell-border rounded-lg shadow-md px-3 py-2 pointer-events-none whitespace-nowrap"
      style={{ left: position.x, top: position.y, transform: 'translate(-50%, -100%)' }}
    >
      <p className="text-xs font-medium text-shell-text">{note.title}</p>
      <p className="text-[10px] text-shell-muted mt-0.5">
        Track {note.track} · {formatTime(note.time)}
      </p>
      <div className="flex items-center gap-1.5 mt-1.5">
        <Avatar name={note.creatorName} size="xs" />
        <span className="text-[10px] text-shell-muted">{note.creatorName}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/features/editor/components/TrackHeader.tsx`**

```typescript
import { cn } from '../../../lib/utils'
import { LAYER_COLORS } from '@ama-midi/shared'

const layerKeys = Object.keys(LAYER_COLORS) as (keyof typeof LAYER_COLORS)[]

export interface TrackHeaderProps {
  track:          number
  isMuted:        boolean
  width:          number
  onToggleMute:   () => void
}

export function TrackHeader({ track, isMuted, width, onToggleMute }: TrackHeaderProps) {
  const layerKey   = layerKeys[(track - 1) % layerKeys.length]
  const layerColor = LAYER_COLORS[layerKey].primary

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 h-8 border-r border-canvas-border bg-canvas-surface select-none transition-opacity cursor-pointer',
        isMuted && 'opacity-30',
      )}
      style={{ width }}
      onClick={onToggleMute}
      title={isMuted ? `Track ${track} (muted)` : `Track ${track} — click to mute`}
    >
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: layerColor }} />
      <span className="text-xs text-canvas-text truncate flex-1">T{track}</span>
      {isMuted && <span className="text-[9px] text-canvas-muted ml-auto">M</span>}
    </div>
  )
}
```

- [ ] **Step 5: Create `src/features/editor/components/TimeAxis.tsx`**

```typescript
import { TIME_AXIS_WIDTH } from '../../../lib/constants'
import { TIME_MAX } from '@ama-midi/shared'

export interface TimeAxisProps {
  pxPerSecond: number
  scrollTop:   number
}

export function TimeAxis({ pxPerSecond, scrollTop }: TimeAxisProps) {
  const totalHeight = TIME_MAX * pxPerSecond
  const labels: { y: number; text: string }[] = []
  const step = pxPerSecond * 10
  for (let y = 0; y <= totalHeight; y += step) {
    const time = Math.round(y / pxPerSecond)
    labels.push({ y: y - scrollTop, text: `${time}s` })
  }

  return (
    <div
      className="shrink-0 relative overflow-hidden bg-canvas-surface border-r border-canvas-border"
      style={{ width: TIME_AXIS_WIDTH }}
    >
      {labels.map((label) => (
        <span
          key={label.text}
          className="absolute left-1 text-[9px] text-canvas-muted font-mono select-none"
          style={{ top: label.y }}
        >
          {label.text}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Create `src/features/editor/components/Playhead.tsx`**

```typescript
import { timeToY } from '../engine'

export interface PlayheadProps {
  time:        number
  pxPerSecond: number
  scrollTop:   number
}

export function Playhead({ time, pxPerSecond, scrollTop }: PlayheadProps) {
  const y = timeToY(time, pxPerSecond) - scrollTop
  return (
    <div
      className="absolute left-0 right-0 pointer-events-none z-10 transition-transform duration-100 ease-linear"
      style={{ top: y }}
    >
      <div
        className="absolute -left-0 -top-[4px] w-0 h-0"
        style={{
          borderTop:    '4px solid transparent',
          borderBottom: '4px solid transparent',
          borderLeft:   '6px solid #6C63FF',
        }}
      />
      <div className="h-[2px] bg-primary w-full" />
    </div>
  )
}
```

- [ ] **Step 7: Create `src/features/editor/components/GridLines.tsx`**

> Receives `virtualItems` from the caller's `useVirtualizer` — never iterates time positions with a plain loop.

```typescript
import type { VirtualItem } from '@tanstack/react-virtual'

export interface GridLinesProps {
  virtualItems: VirtualItem[]
  gridWidth:    number
  trackCount?:  number
}

export function GridLines({ virtualItems, gridWidth, trackCount = 8 }: GridLinesProps) {
  const tw = gridWidth / trackCount
  return (
    <>
      {virtualItems.map((row) => {
        const isBold = row.index % 10 === 0
        return (
          <div
            key={row.index}
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top:        row.start,
              height:     1,
              background: isBold ? 'var(--canvas-grid-bold)' : 'var(--canvas-grid)',
            }}
          />
        )
      })}
      {Array.from({ length: trackCount - 1 }, (_, t) => (
        <div
          key={`v${t}`}
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{ left: (t + 1) * tw, width: 1, background: 'var(--canvas-grid)' }}
        />
      ))}
    </>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: editor sub-components — NoteCircle, GhostCircle, TrackHeader, TimeAxis, Playhead, NoteTooltip, GridLines"
```

---

## Task 8: Extend Editor Store + Keyboard Shortcuts Hook

> **Rule:** EXTEND `editor.store.ts` — append new fields and actions. Do NOT rewrite it. Existing consumers (`EditorPage`, `PianoRoll`) read only the fields they use; new fields are invisible to them until they opt in.

**Files:**
- Modify: `src/store/editor.store.ts`
- Create: `src/hooks/useKeyboardShortcuts.ts`

- [ ] **Step 1: Append new fields to `src/store/editor.store.ts`**

Add the following to the existing store — keep all current fields unchanged:

```typescript
// ADD to EditorStore interface:
editorMode:     'fast' | 'popup'
selectedNoteId: string | null
rightPanelTab:  'details' | 'validation' | 'history'
leftCollapsed:  boolean
rightCollapsed: boolean
playheadTime:   number
setEditorMode:     (mode: 'fast' | 'popup') => void
selectNote:        (id: string | null) => void
setRightPanelTab:  (tab: 'details' | 'validation' | 'history') => void
toggleLeftPanel:   () => void
toggleRightPanel:  () => void
setPlayheadTime:   (time: number) => void

// ADD to create() body defaults:
editorMode:     'fast',
selectedNoteId: null,
rightPanelTab:  'details',
leftCollapsed:  false,
rightCollapsed: false,
playheadTime:   0,
setEditorMode:    (editorMode) => set({ editorMode }),
selectNote:       (selectedNoteId) => set({ selectedNoteId }),
setRightPanelTab: (rightPanelTab) => set({ rightPanelTab }),
toggleLeftPanel:  () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
toggleRightPanel: () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),
setPlayheadTime:  (playheadTime) => set({ playheadTime }),
```

- [ ] **Step 2: Create `src/hooks/useKeyboardShortcuts.ts`**

```typescript
import { useEffect } from 'react'
import { useEditorStore } from '../store/editor.store'

interface Options {
  canEdit:           boolean
  onUndo:            () => void
  onDeleteNote:      () => void
  onEditNote:        () => void
  onJumpToStart?:    () => void
  onToggleShortcuts?: () => void
}

export function useKeyboardShortcuts({
  canEdit, onUndo, onDeleteNote, onEditNote, onJumpToStart, onToggleShortcuts,
}: Options) {
  const { viewMode, selectedNoteId, setZoom } = useEditorStore()

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if ((e.key === 'e' || e.key === 'E') && selectedNoteId && canEdit) {
        e.preventDefault(); onEditNote()
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNoteId && canEdit) {
        e.preventDefault(); onDeleteNote()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && canEdit) {
        e.preventDefault(); onUndo()
      }
      if ((e.key === 'j' || e.key === 'J') && viewMode === 'qa') {
        e.preventDefault(); onJumpToStart?.()
      }
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        onToggleShortcuts?.()
      }
      if (e.key === '1') setZoom(1)
      if (e.key === '2') setZoom(2)
      if (e.key === '4') setZoom(4)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canEdit, viewMode, selectedNoteId, setZoom, onUndo, onDeleteNote, onEditNote, onJumpToStart, onToggleShortcuts])
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: extend editor store (panel collapse, playhead, editorMode) + useKeyboardShortcuts"
```

---

## Task 9: Rebuild Pages + Song Components

> **NoteBlock is NOT deleted in this task.** PianoRoll still uses it. Delete happens in Task 10.

**Files:**
- Create: `src/features/songs/SongCard.tsx`
- Create: `src/features/songs/SongGrid.tsx`
- Modify: `src/pages/SongListPage.tsx`
- Modify: `src/pages/EditorPage.tsx`
- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/features/songs/SongCard.tsx`**

```typescript
import { useNavigate } from 'react-router-dom'
import { cn, timeAgo } from '../../lib/utils'
import { Button, StatusBadge } from '../../components/ui'
import { NOTE_PRESET_COLORS } from '@ama-midi/shared'
import type { Song } from '@ama-midi/shared'

function TrackDots({ noteCount }: { noteCount: number }) {
  const filled = Math.min(8, Math.round((noteCount / 50) * 8))
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full transition-colors"
          style={{ backgroundColor: i < filled ? NOTE_PRESET_COLORS[i % NOTE_PRESET_COLORS.length] : 'var(--shell-border)' }}
        />
      ))}
    </div>
  )
}

export function SongCard({ song, className }: { song: Song; className?: string }) {
  const navigate = useNavigate()
  return (
    <div
      className={cn(
        'bg-shell-surface rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-5 border border-shell-border cursor-pointer group',
        className,
      )}
      onClick={() => navigate(`/songs/${song.id}`)}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-shell-text text-[15px] truncate">{song.name}</h3>
        <StatusBadge status="draft" />
      </div>
      <TrackDots noteCount={song.noteCount ?? 0} />
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-shell-muted truncate">{song.creatorName ?? 'Unknown'}</span>
        <span className="text-xs text-shell-muted">{timeAgo(song.updatedAt)}</span>
      </div>
      <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="primary" size="sm" rounded className="w-full"
          onClick={(e) => { e.stopPropagation(); navigate(`/songs/${song.id}`) }}
        >
          Open Editor
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/features/songs/SongGrid.tsx`**

```typescript
import { SongCard } from './SongCard'
import { Skeleton } from '../../components/ui'
import type { Song } from '@ama-midi/shared'

export function SongGrid({ songs, isLoading }: { songs: Song[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-shell-surface rounded-xl border border-shell-border p-5">
            <Skeleton height={16} width="75%" className="mb-3" />
            <div className="flex gap-1.5 mb-3">
              {Array.from({ length: 8 }).map((_, j) => <Skeleton key={j} width={8} height={8} rounded="full" />)}
            </div>
            <Skeleton height={12} width="50%" />
          </div>
        ))}
      </div>
    )
  }

  if (songs.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-shell-muted text-sm">No songs yet — create your first one</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {songs.map((song) => <SongCard key={song.id} song={song} />)}
    </div>
  )
}
```

- [ ] **Step 3: Rebuild `src/pages/SongListPage.tsx`**

```typescript
import { useState } from 'react'
import { AppShell } from '../components/layout'
import { Button, Input } from '../components/ui'
import { SongGrid } from '../features/songs/SongGrid'
import { useSongs, useCreateSong } from '../features/songs/useSongs'

export function SongListPage() {
  const { data: songs = [], isLoading } = useSongs()
  const createSong = useCreateSong()
  const [newName, setNewName] = useState('')

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    createSong.mutate(newName.trim(), { onSuccess: () => setNewName('') })
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-shell-text">My Songs</h1>
        <form onSubmit={handleCreate} className="flex gap-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New song name…" size="sm" />
          <Button type="submit" variant="primary" size="sm" rounded loading={createSong.isPending} disabled={!newName.trim()}>
            + New Song
          </Button>
        </form>
      </div>
      <SongGrid songs={songs} isLoading={isLoading} />
    </AppShell>
  )
}
```

- [ ] **Step 4: Rebuild `src/pages/EditorPage.tsx` using EditorShell**

Compose the existing feature components (`PianoRoll`, `HistoryPanel`, `ValidationPanel`, `PresenceBar`, `ShortcutLegend`) into the 5-zone shell. Key structural changes:

- Wrap with `<EditorShell topBar={...} leftPanel={...} rightPanel={...} bottomBar={...}>` instead of manual `flex flex-col h-screen`
- Use `ToggleGroup` for view mode switcher (replaces inline button map)
- Replace inline keyboard `useEffect` with `useKeyboardShortcuts` hook
- Read `leftCollapsed`, `rightCollapsed`, `toggleLeftPanel`, `toggleRightPanel` from store
- BottomBar: zoom toggle via `ToggleGroup`, time display, validation badge

- [ ] **Step 5: Update `src/App.tsx` — init theme on mount**

```typescript
// Add near top of App component (before return):
import { useThemeStore } from './store/theme.store'

// Inside App():
useThemeStore.getState() // triggers persist rehydration + applyTheme
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: rebuild pages with EditorShell + AppShell + SongCard/SongGrid"
```

---

## Task 10: Rewrite PianoRoll + Delete NoteBlock

> Both steps happen in one commit. NoteBlock is only deleted after PianoRoll no longer imports it.

**Files:**
- Modify: `src/features/editor/components/PianoRoll.tsx`
- Modify: `src/features/editor/components/AiSuggestions.tsx`
- Modify: `src/features/editor/components/NotePopup.tsx`
- Delete: `src/features/editor/components/NoteBlock.tsx`

- [ ] **Step 1: Rewrite `PianoRoll.tsx` using new sub-components**

Key structural changes vs current implementation:

```typescript
// BEFORE — what changes:
import { NoteBlock } from './NoteBlock'           // → remove
// inline ghost div                               // → <GhostCircle>
// inline rowVirtualizer render loop             // → <GridLines virtualItems={...}>
// inline vertical track dividers               // → moved into GridLines
// internal useEffect keyboard handler          // → removed (EditorPage uses useKeyboardShortcuts)

// AFTER — new imports:
import { NoteCircle  } from './NoteCircle'
import { GhostCircle } from './GhostCircle'
import { GridLines   } from './GridLines'
import { Playhead    } from './Playhead'
```

Full rewrite (keep existing hooks — `useVirtualizer`, `useNotes`, `useCreateNote`, `useDeleteNote` — unchanged):

```typescript
import { useRef, useState, useCallback, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { TIME_MAX } from '@ama-midi/shared'
import { useEditorStore } from '../../../store/editor.store'
import { useNotes, useCreateNote, useDeleteNote } from '../../notes/useNotes'
import { xToTrack, yToTime, trackToX, timeToY, trackWidth } from '../engine'
import { getTotalHeight, getPrefetchTimeRange } from '../engine'
import { NoteCircle  } from './NoteCircle'
import { GhostCircle } from './GhostCircle'
import { GridLines   } from './GridLines'
import { Playhead    } from './Playhead'
import { NotePopup   } from './NotePopup'
import { AiSuggestions } from './AiSuggestions'
import type { Note } from '@ama-midi/shared'

type CreateMode = 'fast' | 'popup'
type PopupState =
  | { type: 'create'; track: number; time: number; pos: { x: number; y: number } }
  | { type: 'edit';   note: Note;    pos: { x: number; y: number } }
  | null

interface Props {
  songId:           string
  canEdit?:         boolean
  mutedTracks?:     Set<number>
  onNoteSelected?:  (note: Note | null) => void
}

export function PianoRoll({ songId, canEdit = true, mutedTracks = new Set(), onNoteSelected }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null)
  const pxPerSecondRef = useRef(3)

  const [scrollTop,    setScrollTop]    = useState(0)
  const [ghost,        setGhost]        = useState<{ track: number; time: number } | null>(null)
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [popup,        setPopup]        = useState<PopupState>(null)
  const [createMode,   setCreateMode]   = useState<CreateMode>('fast')

  const { pxPerSecond, viewMode, playheadTime } = useEditorStore()
  pxPerSecondRef.current = pxPerSecond

  const viewportHeight = containerRef.current?.clientHeight ?? 600
  const gridWidth      = containerRef.current?.clientWidth  ?? 800
  const tw             = trackWidth(gridWidth)

  const { timeFrom, timeTo } = getPrefetchTimeRange(scrollTop, viewportHeight, pxPerSecond)
  const { data: notes = [], isLoading } = useNotes(songId, timeFrom, timeTo)
  const createNote = useCreateNote(songId)
  const deleteNote = useDeleteNote(songId)

  const totalHeight = getTotalHeight(pxPerSecond)

  const rowVirtualizer = useVirtualizer({
    count:           TIME_MAX + 1,
    getScrollElement: () => containerRef.current,
    estimateSize:    () => pxPerSecondRef.current,
    overscan:        10,
  })

  useEffect(() => { rowVirtualizer.measure() }, [pxPerSecond]) // eslint-disable-line

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!canEdit || !containerRef.current) return
    const rect  = containerRef.current.getBoundingClientRect()
    const x     = e.clientX - rect.left
    const y     = e.clientY - rect.top + scrollTop
    const track = xToTrack(x, gridWidth)
    const time  = yToTime(y, pxPerSecond)
    setGhost({ track, time })
  }, [canEdit, gridWidth, pxPerSecond, scrollTop])

  const handleGridClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!canEdit || !ghost) return
    if (createMode === 'popup') {
      setPopup({ type: 'create', track: ghost.track, time: ghost.time, pos: { x: e.clientX, y: e.clientY } })
      setGhost(null)
      return
    }
    setGhost(null)
    createNote.mutate({ track: ghost.track, time: ghost.time, title: `Note ${ghost.track}:${ghost.time}` })
  }, [canEdit, ghost, createNote, createMode])

  const handleNoteClick = useCallback((note: Note, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedNote(note)
    onNoteSelected?.(note)
    setPopup({ type: 'edit', note, pos: { x: e.clientX, y: e.clientY } })
  }, [onNoteSelected])

  // Keyboard: E = edit, Delete = delete, Escape = deselect
  // Zoom and undo shortcuts live in useKeyboardShortcuts (EditorPage)
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.key === 'e' || e.key === 'E') && selectedNote && canEdit && !popup) {
        setPopup({ type: 'edit', note: selectedNote, pos: { x: window.innerWidth / 2 - 160, y: window.innerHeight / 2 - 230 } })
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNote && canEdit && !popup) {
        deleteNote.mutate(selectedNote.id)
        setSelectedNote(null)
        onNoteSelected?.(null)
      }
      if (e.key === 'Escape' && !popup) {
        setSelectedNote(null)
        onNoteSelected?.(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNote, canEdit, deleteNote, popup, onNoteSelected])

  const visibleNotes = notes.filter((n) => !mutedTracks.has(n.track))

  if (isLoading) { /* keep existing skeleton */ }

  return (
    <div className="relative flex-1 overflow-hidden flex flex-col">
      {/* Track headers */}
      <div className="flex border-b border-canvas-border bg-canvas-surface h-8 shrink-0">
        {Array.from({ length: 8 }, (_, i) => i + 1).map((track) => (
          <div
            key={track}
            className={`flex items-center justify-center text-xs border-r border-canvas-border transition-opacity select-none ${mutedTracks.has(track) ? 'opacity-30 text-canvas-muted' : 'text-canvas-muted'}`}
            style={{ width: tw }}
          >
            T{track}
          </div>
        ))}
      </div>

      {/* Create mode toggle */}
      {canEdit && (
        <div className="absolute top-9 left-2 z-30">
          <button
            onClick={() => setCreateMode((m) => (m === 'fast' ? 'popup' : 'fast'))}
            className={`px-2 py-0.5 text-[10px] border rounded transition-colors ${createMode === 'popup' ? 'bg-primary text-white border-primary' : 'text-canvas-muted border-canvas-border hover:text-canvas-text'}`}
          >
            {createMode === 'popup' ? '⊞ Popup' : '⚡ Fast'}
          </button>
        </div>
      )}

      {/* Scrollable grid */}
      <div
        ref={containerRef}
        className="overflow-y-auto overflow-x-hidden flex-1"
        onScroll={handleScroll}
        onMouseMove={handleMouseMove}
        onClick={handleGridClick}
        onMouseLeave={() => canEdit && setGhost(null)}
      >
        <div className="relative" style={{ height: totalHeight }}>
          {/* Grid lines — pass virtual items, no plain loop */}
          <GridLines
            virtualItems={rowVirtualizer.getVirtualItems()}
            gridWidth={gridWidth}
          />

          {/* Playhead */}
          <Playhead time={playheadTime} pxPerSecond={pxPerSecond} scrollTop={scrollTop} />

          {/* Notes */}
          {visibleNotes.map((note) => (
            <NoteCircle
              key={note.id}
              note={note}
              gridWidth={gridWidth}
              pxPerSecond={pxPerSecond}
              viewMode={viewMode}
              isSelected={selectedNote?.id === note.id}
              allNotes={notes}
              onClick={handleNoteClick}
            />
          ))}

          {/* Ghost note preview */}
          {canEdit && ghost && (
            <GhostCircle
              track={ghost.track}
              time={ghost.time}
              gridWidth={gridWidth}
              pxPerSecond={pxPerSecond}
            />
          )}

          {visibleNotes.length === 0 && viewMode === 'composer' && canEdit && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-canvas-muted">Click anywhere to place your first note</p>
            </div>
          )}
        </div>
      </div>

      {canEdit && <AiSuggestions songId={songId} notes={notes} gridWidth={gridWidth} pxPerSecond={pxPerSecond} scrollTop={scrollTop} />}

      {popup && (
        popup.type === 'create' ? (
          <NotePopup mode="create" songId={songId} initialTrack={popup.track} initialTime={popup.time} pos={popup.pos} onClose={() => setPopup(null)} />
        ) : (
          <NotePopup mode="edit" songId={songId} note={popup.note} pos={popup.pos} onClose={() => setPopup(null)} />
        )
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update `AiSuggestions.tsx` — circle shape for ghost notes**

Replace any rectangle ghost divs with `16px` circle + `animate-ghost-pulse` class:

```typescript
// BEFORE:
<div className="absolute ... border-2 border-primary/50 bg-primary/20 rounded-sm" ... />
// AFTER:
<div className="absolute w-4 h-4 rounded-full border-2 border-primary/50 bg-primary/20 animate-ghost-pulse" ... />
```

- [ ] **Step 3: Update `NotePopup.tsx` — wrap with Modal primitive**

Replace manual backdrop + focus trap with `Modal.Root` / `Modal.Content`:

```typescript
import { Modal } from '../../../components/ui'

// Wrap existing NotePopup content:
<Modal.Root open onOpenChange={(open) => !open && onClose()}>
  <Modal.Content>
    <Modal.Header onClose={onClose}>{mode === 'create' ? 'Place Note' : 'Edit Note'}</Modal.Header>
    <Modal.Body>
      {/* existing form fields */}
    </Modal.Body>
    <Modal.Footer>
      {/* existing buttons */}
    </Modal.Footer>
  </Modal.Content>
</Modal.Root>
```

- [ ] **Step 4: Verify build compiles**

```bash
cd apps/web && pnpm build
```

Expected: zero TypeScript errors, zero missing imports.

- [ ] **Step 5: Delete NoteBlock (build must pass first)**

```bash
rm apps/web/src/features/editor/components/NoteBlock.tsx
cd apps/web && pnpm build   # verify still clean
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: rewrite PianoRoll with NoteCircle/GhostCircle/GridLines/Playhead — remove NoteBlock"
```

---

## Task 11: Cleanup + Verification

- [ ] **Step 1: Run build**

```bash
pnpm build
```

Expected: clean build, zero errors.

- [ ] **Step 2: Manual verification checklist**

Run `pnpm dev` and verify:

- [ ] SongListPage renders via AppShell — header shows user avatar + sign out
- [ ] SongGrid: loading skeletons → cards with TrackDots
- [ ] EditorPage renders via EditorShell — 5 zones at correct dimensions
- [ ] View mode ToggleGroup switches between composer/developer/qa
- [ ] Composer: notes as 16px circles, white ring on select
- [ ] Developer: hover shows ID overlay on note
- [ ] QA: orange ring for boundary notes, yellow for close neighbors
- [ ] Ghost circle appears on hover, disappears on click
- [ ] Playhead line visible (moves with `playheadTime` if tested)
- [ ] GridLines still virtualized — DOM nodes < 100 with 500+ notes
- [ ] Tablet width: right panel collapses to overlay
- [ ] Mobile width: panels become sheets with backdrop dismiss
- [ ] NotePopup opens with Modal focus trap — Escape closes it
- [ ] Ghost notes in AI suggestions are circles with pulse animation
- [ ] Dark mode toggle (via `useThemeStore().setMode('dark')`) flips shell tokens
- [ ] Old `bg-editor-bg`, `bg-surface` classes still work in any unchanged components

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "chore: final cleanup + verification pass"
```

---

## Summary

| Task | Description | Key change from v1 |
|------|-------------|-------------------|
| 1 | Deps + lib utilities | Unchanged |
| 2 | Theme tokens + store + hooks | **Additive only** — alias new `shell`/`canvas` tokens to existing vars |
| 3 | UI: Button, Badge, StatusBadge, IconButton | Unchanged |
| 4 | UI: Avatar, AvatarStack, Input, Textarea, ColorPicker, Skeleton | Unchanged |
| 5 | UI: Modal, Tabs, Tooltip, ToggleGroup | Unchanged |
| 6 | Layout: EditorShell + AppShell | Unchanged |
| 7 | Editor sub-components | **GridLines takes `virtualItems` prop** — no plain loop; **NoteCircle imports from `engine/index.ts` barrel** |
| 8 | Store extension + keyboard shortcuts | **Extend store** (append fields) — not rewrite |
| 9 | Rebuild pages + SongCard/SongGrid | **No `rm NoteBlock.tsx`** |
| 10 | Rewrite PianoRoll + delete NoteBlock | **NoteBlock deleted inside this task** — after build confirms PianoRoll no longer imports it |
| 11 | Cleanup + verification | Unchanged |

**Est. time: ~2 hours**
