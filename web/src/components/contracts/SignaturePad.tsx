"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Props = {
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
};

/** Mouse / finger signature pad. Outputs PNG data URL when there is ink. */
export function SignaturePad({ onChange, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const wentOutside = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [empty, setEmpty] = useState(true);
  const [outOfBounds, setOutOfBounds] = useState(false);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = parent.clientWidth;
    const cssH = 160;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.25;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    hasInk.current = false;
    wentOutside.current = false;
    setEmpty(true);
    setOutOfBounds(false);
    onChangeRef.current(null);
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  function rawPoint(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      rect,
    };
  }

  function markIfOutside(x: number, y: number, w: number, h: number) {
    if (x < 0 || y < 0 || x > w || y > h) {
      if (!wentOutside.current) {
        wentOutside.current = true;
        setOutOfBounds(true);
      }
    }
  }

  function emit() {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk.current) {
      onChangeRef.current(null);
      return;
    }
    onChangeRef.current(canvas.toDataURL("image/png"));
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = rawPoint(e);
    markIfOutside(p.x, p.y, p.rect.width, p.rect.height);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = rawPoint(e);
    markIfOutside(p.x, p.y, p.rect.width, p.rect.height);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!hasInk.current) {
      hasInk.current = true;
      setEmpty(false);
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    emit();
  }

  function clear() {
    resizeCanvas();
  }

  return (
    <div>
      <div
        className={`relative overflow-hidden rounded-lg border bg-white touch-none ${
          outOfBounds ? "border-amber-500" : "border-neutral-300"
        }`}
      >
        <canvas
          ref={canvasRef}
          className="block w-full cursor-crosshair touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        {empty ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
            Draw your signature here
          </div>
        ) : null}
      </div>
      {outOfBounds ? (
        <p className="mt-1 text-xs font-semibold text-amber-800">
          Part of your signature went outside the box. Clear and try again if you
          want the full signature visible.
        </p>
      ) : null}
      <div className="mt-1 flex items-center justify-between">
        <p className="text-xs text-neutral-500">
          Use your finger on a phone, or mouse / trackpad on desktop.
        </p>
        <button
          type="button"
          disabled={disabled || empty}
          onClick={clear}
          className="text-xs font-semibold text-neutral-700 underline disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
