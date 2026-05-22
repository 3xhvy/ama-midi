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

        <main className="flex-1 overflow-hidden bg-canvas-bg flex flex-col min-h-0">
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
