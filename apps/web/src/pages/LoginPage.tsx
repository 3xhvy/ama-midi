import { useEffect, useRef, useState, useCallback } from 'react'
import { AmanotesLogo } from '../components/AmanotesLogo'

const GOOGLE_AUTH_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/auth/google`
  : '/auth/google'

/* ── Brand palette ─────────────────────────────────────── */
const TRACK_COLORS = [
  '#FF7B7B', '#FFB347', '#7ED56F', '#40E0D0',
  '#5B9BFF', '#9B7FFF', '#FF78BE', '#FF9F6B',
]
const PINK   = '#ff3177'
const PURPLE = '#5b00e3'
const BG     = '#07050f'

/* ── Falling-note particle ──────────────────────────────── */
interface NoteParticle {
  lane:    number   // 0–7
  y:       number   // canvas pixels from top
  height:  number
  speed:   number
  alpha:   number
  scale:   number   // visual width multiplier
}

function spawnNote(_canvasW: number): NoteParticle {
  return {
    lane:   Math.floor(Math.random() * 8),
    y:      -60 - Math.random() * 300,
    height: 18 + Math.random() * 28,
    speed:  1.2 + Math.random() * 2.4,
    alpha:  0.55 + Math.random() * 0.45,
    scale:  0.55 + Math.random() * 0.45,
  }
}

/* ── Canvas renderer ────────────────────────────────────── */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  particles: NoteParticle[],
) {
  ctx.clearRect(0, 0, W, H)

  /* gradient sky */
  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0,   '#07050f')
  sky.addColorStop(0.6, '#0d0820')
  sky.addColorStop(1,   '#110929')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)

  const vx = W / 2          // vanishing-point x
  const vy = H * 0.38       // vanishing-point y

  /* horizon glow */
  const hgr = ctx.createRadialGradient(vx, vy, 0, vx, vy, W * 0.55)
  hgr.addColorStop(0,   'rgba(91,0,227,0.22)')
  hgr.addColorStop(0.5, 'rgba(255,49,119,0.07)')
  hgr.addColorStop(1,   'transparent')
  ctx.fillStyle = hgr
  ctx.fillRect(0, 0, W, H)

  /* lane edges at bottom */
  const laneW  = W / 8
  const margin = laneW * 0.08

  /* perspective grid lines radiating to vanishing point */
  ctx.save()
  for (let i = 0; i <= 8; i++) {
    const bx = i * laneW
    ctx.beginPath()
    ctx.moveTo(bx, H)
    ctx.lineTo(vx + (bx - W / 2) * 0.12, vy)
    const frac = i / 8
    const hue  = frac * 280 + 200
    ctx.strokeStyle = `hsla(${hue},80%,65%,0.18)`
    ctx.lineWidth   = 1
    ctx.stroke()
  }
  /* horizontal grid lines */
  const gridRows = 10
  for (let r = 1; r < gridRows; r++) {
    const t  = r / gridRows
    const y  = vy + (H - vy) * t
    const xl = vx + (0 - W / 2) * (1 - (1 - t) * 0.88)
    const xr = vx + (W - W / 2) * (1 - (1 - t) * 0.88)
    ctx.beginPath()
    ctx.moveTo(xl, y)
    ctx.lineTo(xr, y)
    ctx.strokeStyle = `rgba(180,175,255,${0.04 + t * 0.09})`
    ctx.lineWidth   = 0.8
    ctx.stroke()
  }
  ctx.restore()

  /* lane floor glow strips */
  for (let i = 0; i < 8; i++) {
    const bx    = i * laneW + margin
    const bw    = laneW - margin * 2
    const color = TRACK_COLORS[i]!
    const grd   = ctx.createLinearGradient(0, vy, 0, H)
    grd.addColorStop(0, `${color}00`)
    grd.addColorStop(1, `${color}18`)
    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.rect(bx, vy, bw, H - vy)
    ctx.fill()
  }

  /* falling note particles */
  for (const p of particles) {
    const color  = TRACK_COLORS[p.lane]!
    const bx     = p.lane * laneW + margin
    const bw     = laneW - margin * 2

    /* perspective scale: notes appear smaller near horizon */
    const tFrac  = Math.max(0, Math.min(1, (p.y - vy) / (H - vy)))
    const pScale = 0.15 + tFrac * 0.85
    const pw     = bw  * pScale * p.scale
    const ph     = p.height * pScale
    const cx     = bx + bw / 2 - pw / 2

    /* perspective x convergence */
    const xShift = (vx - (bx + bw / 2)) * (1 - tFrac) * 0.88
    const drawX  = cx + xShift
    const drawY  = p.y - ph / 2

    const alpha  = p.alpha * Math.min(1, tFrac * 3)

    /* glow */
    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur  = 12 * pScale
    ctx.globalAlpha = alpha * 0.9

    /* note body */
    ctx.fillStyle = color
    const r = 3 * pScale
    ctx.beginPath()
    ctx.roundRect(drawX, drawY, pw, ph, r)
    ctx.fill()

    /* top highlight line */
    ctx.fillStyle = '#ffffff'
    ctx.globalAlpha = alpha * 0.35
    ctx.beginPath()
    ctx.roundRect(drawX, drawY, pw, Math.max(1, 2 * pScale), r)
    ctx.fill()

    ctx.restore()
  }
}

/* ── Google icon ────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

/* ── Main ───────────────────────────────────────────────── */
export function LoginPage() {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const rafRef     = useRef<number>(0)
  const notesRef   = useRef<NoteParticle[]>([])
  const spawnTimer = useRef(0)

  /* card 3-D tilt */
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current
    if (!el) return
    const { left, top, width, height } = el.getBoundingClientRect()
    const mx = (e.clientX - left) / width  - 0.5   // –0.5 … 0.5
    const my = (e.clientY - top)  / height - 0.5
    setTilt({ rx: -my * 14, ry: mx * 14 })
  }, [])

  const onMouseLeave = useCallback(() => {
    setTilt({ rx: 0, ry: 0 })
  }, [])

  /* canvas loop */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    /* seed particles */
    notesRef.current = Array.from({ length: 28 }, () =>
      spawnNote(canvas.width),
    )
    /* push half below screen so it looks mid-song on load */
    notesRef.current.forEach((p, i) => {
      if (i < 14) p.y = Math.random() * canvas.height * 1.2
    })

    let lastTime = 0
    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.67, 3)
      lastTime = now
      const W = canvas.width
      const H = canvas.height

      /* move particles */
      for (const p of notesRef.current) {
        p.y += p.speed * dt
        if (p.y - p.height / 2 > H + 20) {
          Object.assign(p, spawnNote(W))
        }
      }

      /* spawn new notes occasionally */
      spawnTimer.current += dt
      if (spawnTimer.current > 18 && notesRef.current.length < 40) {
        notesRef.current.push(spawnNote(W))
        spawnTimer.current = 0
      }

      drawFrame(ctx, W, H, notesRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  /* inject Syne font */
  useEffect(() => {
    if (document.getElementById('syne-font')) return
    const link = document.createElement('link')
    link.id   = 'syne-font'
    link.rel  = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap'
    document.head.appendChild(link)
  }, [])

  const cardStyle: React.CSSProperties = {
    transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateZ(0)`,
    transition: tilt.rx === 0 && tilt.ry === 0
      ? 'transform 0.6s cubic-bezier(0.34,1.56,0.64,1)'
      : 'transform 0.08s linear',
    willChange: 'transform',
  }

  return (
    <div
      style={{ background: BG, fontFamily: 'var(--font-sans)' }}
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden"
    >
      {/* Keyframe styles */}
      <style>{`
        @keyframes login-float {
          0%, 100% { transform: translateY(0px);   }
          50%       { transform: translateY(-8px);  }
        }
        @keyframes login-fade-up {
          from { opacity: 0; transform: translateY(28px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes login-rim-spin {
          from { background-position: 0% 50%;   }
          to   { background-position: 100% 50%; }
        }
        .login-card-wrap {
          animation: login-float 5s ease-in-out infinite;
        }
        .login-card-enter {
          animation: login-fade-up 0.7s cubic-bezier(0.34,1.36,0.64,1) both;
        }
        .login-rim {
          background: linear-gradient(135deg, ${PINK}, ${PURPLE}, #6c63ff, ${PINK});
          background-size: 300% 300%;
          animation: login-rim-spin 4s linear infinite;
          padding: 1.5px;
          border-radius: 20px;
        }
        .login-btn-glow:hover {
          box-shadow: 0 0 28px rgba(255,49,119,0.45), 0 0 0 1px rgba(255,49,119,0.4);
        }
      `}</style>

      {/* ── 3-D canvas background ───────── */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      />

      {/* ── Vignette overlay ───────────── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 75% 75% at 50% 55%, transparent 30%, rgba(7,5,15,0.78) 100%)',
        }}
      />

      {/* ── Login card ─────────────────── */}
      <div className="login-card-wrap relative z-10 w-full max-w-sm px-4">
        <div
          className="login-card-enter"
          ref={cardRef}
          style={cardStyle}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        >
          <div className="login-rim">
            <div
              style={{
                background: 'linear-gradient(160deg, rgba(22,19,42,0.97) 0%, rgba(11,9,24,0.98) 100%)',
                backdropFilter: 'blur(24px)',
                borderRadius: '18px',
              }}
              className="relative overflow-hidden px-8 pb-10 pt-10"
            >
              {/* inner top glow */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${PINK}88, ${PURPLE}88, transparent)` }}
              />

              {/* track-color dots row — decorative lane indicator */}
              <div className="mb-8 flex justify-center gap-1.5">
                {TRACK_COLORS.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      background: c,
                      boxShadow: `0 0 6px ${c}`,
                      opacity: 0.75 + i * 0.03,
                    }}
                  />
                ))}
              </div>

              {/* logo */}
              <div
                className="mb-6 flex justify-center"
                style={{
                  filter: 'brightness(1.55) drop-shadow(0 0 14px rgba(255,255,255,0.22)) drop-shadow(0 0 6px rgba(255,49,119,0.35))',
                }}
              >
                <AmanotesLogo className="h-9 w-auto max-w-[220px]" />
              </div>

              {/* headline */}
              <div className="mb-1 text-center">
                <h1
                  style={{
                    fontFamily: "'Syne', var(--font-sans)",
                    fontWeight: 800,
                    fontSize: '1.6rem',
                    letterSpacing: '-0.02em',
                    background: `linear-gradient(125deg, #f4f2ff 20%, ${PINK} 60%, ${PURPLE})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    lineHeight: 1.15,
                  }}
                >
                  AMA-MIDI
                </h1>
              </div>

              <p
                className="mb-8 text-center text-xs tracking-widest uppercase"
                style={{ color: 'rgba(244,242,255,0.38)', letterSpacing: '0.2em' }}
              >
                Chart Authoring · Internal
              </p>

              {/* sign-in button */}
              <a
                href={GOOGLE_AUTH_URL}
                className="login-btn-glow flex w-full items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition-all duration-200"
                style={{
                  background: `linear-gradient(135deg, ${PINK}cc, ${PURPLE}cc)`,
                  border: `1px solid rgba(255,255,255,0.12)`,
                  boxShadow: '0 2px 12px rgba(91,0,227,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                  letterSpacing: '0.01em',
                }}
              >
                <GoogleIcon />
                <span>Sign in with Google</span>
              </a>

              {/* fine print */}
              <p className="mt-5 text-center" style={{ fontSize: 10, color: 'rgba(244,242,255,0.22)', lineHeight: 1.6 }}>
                Access restricted to{' '}
                <span style={{ color: 'rgba(244,242,255,0.42)' }}>@amanotes.com</span> accounts.
                <br />Contact your lead to request COMPOSER access.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── bottom lane strip ───────────── */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 flex h-1"
        aria-hidden
      >
        {TRACK_COLORS.map((c, i) => (
          <div
            key={i}
            style={{ flex: 1, background: c, opacity: 0.6, boxShadow: `0 0 8px ${c}` }}
          />
        ))}
      </div>
    </div>
  )
}
