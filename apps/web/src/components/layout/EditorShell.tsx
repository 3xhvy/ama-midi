import { useIsMobile, useIsTablet } from '../../hooks/useMediaQuery'
import { TOPBAR_HEIGHT, BOTTOMBAR_HEIGHT, PANEL_WIDTHS } from '../../lib/constants'

export interface EditorShellProps {
  topBar:          React.ReactNode
  leftPanel:       React.ReactNode
  rightPanel:      React.ReactNode
  bottomBar:       React.ReactNode
  children:        React.ReactNode
  leftCollapsed?:  boolean
  rightCollapsed?: boolean
  onLeftToggle?:   () => void
  onRightToggle?:  () => void
}

export function EditorShell({
  topBar, leftPanel, rightPanel, bottomBar, children,
  leftCollapsed = false, rightCollapsed = false,
  onLeftToggle, onRightToggle,
}: EditorShellProps) {
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-shell-bg">
      <header className="shrink-0 flex items-center border-b border-shell-border bg-shell-surface px-4" style={{ height: TOPBAR_HEIGHT }}>
        {topBar}
      </header>

      <div className="flex flex-1 overflow-hidden relative">

        {/* Desktop left panel — always mounted, width slides */}
        {!isMobile && (
          <aside
            className="shrink-0 border-r border-shell-border bg-shell-surface overflow-y-auto overflow-x-hidden"
            style={{
              width: leftCollapsed ? 0 : PANEL_WIDTHS.left,
              transition: 'width 250ms ease',
            }}
          >
            <div style={{ width: PANEL_WIDTHS.left }}>
              {leftPanel}
            </div>
          </aside>
        )}

        <main className="flex-1 overflow-hidden bg-canvas-bg flex flex-col min-h-0">
          {children}
        </main>

        {/* Desktop right panel — always mounted, width slides */}
        {!isMobile && !isTablet && (
          <aside
            className="shrink-0 flex flex-col border-l border-shell-border bg-shell-surface overflow-hidden"
            style={{
              width: rightCollapsed ? 0 : PANEL_WIDTHS.right,
              transition: 'width 250ms ease',
            }}
          >
            <div className="flex flex-col h-full" style={{ width: PANEL_WIDTHS.right }}>
              {rightPanel}
            </div>
          </aside>
        )}

        {/* Tablet right panel — overlay drawer, slides from right */}
        {isTablet && (
          <aside
            className="absolute top-0 right-0 h-full flex flex-col border-l border-shell-border bg-shell-surface overflow-hidden shadow-lg z-40"
            style={{
              width: PANEL_WIDTHS.right,
              transform: rightCollapsed ? 'translateX(100%)' : 'translateX(0)',
              transition: 'transform 250ms ease',
            }}
          >
            {rightPanel}
          </aside>
        )}

        {/* Mobile left drawer — slides from left */}
        {isMobile && (
          <div
            className="absolute inset-0 z-40 flex"
            style={{
              pointerEvents: leftCollapsed ? 'none' : 'auto',
              visibility: leftCollapsed ? 'hidden' : 'visible',
              transition: 'visibility 250ms',
            }}
          >
            <aside
              className="w-[280px] h-full bg-shell-surface border-r border-shell-border overflow-y-auto shadow-lg"
              style={{
                transform: leftCollapsed ? 'translateX(-100%)' : 'translateX(0)',
                transition: 'transform 250ms ease',
              }}
            >
              {leftPanel}
            </aside>
            <div
              className="flex-1"
              style={{
                backgroundColor: leftCollapsed ? 'transparent' : 'rgba(0,0,0,0.3)',
                transition: 'background-color 250ms ease',
              }}
              onClick={onLeftToggle}
            />
          </div>
        )}

        {/* Mobile right drawer — slides from right */}
        {isMobile && (
          <div
            className="absolute inset-0 z-40 flex justify-end"
            style={{
              pointerEvents: rightCollapsed ? 'none' : 'auto',
              visibility: rightCollapsed ? 'hidden' : 'visible',
              transition: 'visibility 250ms',
            }}
          >
            <div
              className="flex-1"
              style={{
                backgroundColor: rightCollapsed ? 'transparent' : 'rgba(0,0,0,0.3)',
                transition: 'background-color 250ms ease',
              }}
              onClick={onRightToggle}
            />
            <aside
              className="w-[280px] h-full flex flex-col bg-shell-surface border-l border-shell-border overflow-hidden shadow-lg"
              style={{
                transform: rightCollapsed ? 'translateX(100%)' : 'translateX(0)',
                transition: 'transform 250ms ease',
              }}
            >
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
