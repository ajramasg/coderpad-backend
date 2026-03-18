import { useRef, useEffect, useState, useCallback } from 'react';

type Tool = 'pen' | 'line' | 'rect' | 'circle' | 'text' | 'eraser';
interface Point { x: number; y: number }

const BG      = '#0d1117';
const COLORS  = ['#e6edf3','#ff7b72','#ffa657','#f7c948','#3fb950','#58a6ff','#bc8cff','#ff7eb6'];
const WIDTHS  = [2, 4, 8];
const TOOLS: { id: Tool; icon: string; title: string }[] = [
  { id: 'pen',    icon: '✏',  title: 'Pen' },
  { id: 'line',   icon: '╱',  title: 'Line' },
  { id: 'rect',   icon: '▭',  title: 'Rectangle' },
  { id: 'circle', icon: '◯',  title: 'Ellipse' },
  { id: 'text',   icon: 'T',  title: 'Text' },
  { id: 'eraser', icon: '⌫', title: 'Eraser' },
];

function getPos(e: React.PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement): Point {
  const r   = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  return {
    x: (e.clientX - r.left) * (canvas.width  / r.width  / dpr),
    y: (e.clientY - r.top)  * (canvas.height / r.height / dpr),
  };
}

function drawShape(ctx: CanvasRenderingContext2D, tool: Tool, a: Point, b: Point) {
  ctx.beginPath();
  if (tool === 'line') {
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
  } else if (tool === 'rect') {
    ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y);
  } else if (tool === 'circle') {
    const rx = (b.x - a.x) / 2, ry = (b.y - a.y) / 2;
    ctx.ellipse(a.x + rx, a.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
  }
  ctx.stroke();
}

export function Whiteboard() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const historyRef = useRef<ImageData[]>([]);
  const hIdx       = useRef(-1);

  const [tool,    setTool]    = useState<Tool>('pen');
  const [color,   setColor]   = useState(COLORS[0]);
  const [width,   setWidth]   = useState(3);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [textPos, setTextPos] = useState<Point | null>(null);
  const [textVal, setTextVal] = useState('');
  const textRef   = useRef<HTMLInputElement>(null);

  const isDown    = useRef(false);
  const startPt   = useRef<Point>({ x: 0, y: 0 });
  const snap      = useRef<ImageData | null>(null);
  const prevPt    = useRef<Point>({ x: 0, y: 0 });

  // Init canvas with device-pixel-ratio awareness
  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap   = wrapRef.current!;
    const dpr    = window.devicePixelRatio || 1;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);
    pushHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    const img    = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current = historyRef.current.slice(0, hIdx.current + 1);
    historyRef.current.push(img);
    if (historyRef.current.length > 60) { historyRef.current.shift(); }
    else { hIdx.current++; }
    setCanUndo(hIdx.current > 0);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (hIdx.current <= 0) return;
    hIdx.current--;
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.putImageData(historyRef.current[hIdx.current], 0, 0);
    setCanUndo(hIdx.current > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    if (hIdx.current >= historyRef.current.length - 1) return;
    hIdx.current++;
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.putImageData(historyRef.current[hIdx.current], 0, 0);
    setCanUndo(true);
    setCanRedo(hIdx.current < historyRef.current.length - 1);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    const dpr    = window.devicePixelRatio || 1;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    pushHistory();
  }, [pushHistory]);

  const exportPNG = useCallback(() => {
    const a = document.createElement('a');
    a.href     = canvasRef.current!.toDataURL('image/png');
    a.download = 'whiteboard.png';
    a.click();
  }, []);

  // Keyboard undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'text') {
      setTextPos(getPos(e, canvasRef.current!));
      setTextVal('');
      setTimeout(() => textRef.current?.focus(), 30);
      return;
    }
    isDown.current = true;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const pos = getPos(e, canvasRef.current!);
    startPt.current = pos;
    prevPt.current  = pos;
    if (['line', 'rect', 'circle'].includes(tool)) {
      snap.current = canvasRef.current!.getContext('2d')!
        .getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    }
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.strokeStyle = tool === 'eraser' ? BG : color;
    ctx.lineWidth   = tool === 'eraser' ? width * 5 : width;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDown.current) return;
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    const pos    = getPos(e, canvas);

    if (tool === 'pen' || tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(prevPt.current.x, prevPt.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      prevPt.current = pos;
    } else if (snap.current) {
      ctx.putImageData(snap.current, 0, 0);
      ctx.strokeStyle = color;
      ctx.lineWidth   = width;
      ctx.lineCap     = 'round';
      drawShape(ctx, tool, startPt.current, pos);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDown.current) return;
    isDown.current = false;
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    const pos    = getPos(e, canvas);
    if (['line', 'rect', 'circle'].includes(tool) && snap.current) {
      ctx.putImageData(snap.current, 0, 0);
      ctx.strokeStyle = color;
      ctx.lineWidth   = width;
      ctx.lineCap     = 'round';
      drawShape(ctx, tool, startPt.current, pos);
      snap.current = null;
    }
    pushHistory();
  };

  const commitText = () => {
    if (!textPos || !textVal.trim()) { setTextPos(null); return; }
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.font      = `${width * 5 + 12}px 'JetBrains Mono', monospace`;
    ctx.fillText(textVal, textPos.x, textPos.y);
    pushHistory();
    setTextPos(null);
    setTextVal('');
  };

  return (
    <div className="wb-root">
      {/* Toolbar */}
      <div className="wb-toolbar">
        <div className="wb-tool-group">
          {TOOLS.map(t => (
            <button key={t.id} title={t.title}
              className={`wb-btn ${tool === t.id ? 'wb-btn-active' : ''}`}
              onClick={() => setTool(t.id)}>{t.icon}</button>
          ))}
        </div>
        <div className="wb-sep" />
        <div className="wb-tool-group">
          {COLORS.map(c => (
            <button key={c} className={`wb-color ${color === c ? 'wb-color-active' : ''}`}
              style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
        <div className="wb-sep" />
        <div className="wb-tool-group">
          {WIDTHS.map(w => (
            <button key={w} title={`${w}px`}
              className={`wb-btn wb-width-btn ${width === w ? 'wb-btn-active' : ''}`}
              onClick={() => setWidth(w)}>
              <span style={{ width: w * 3, height: w * 3, background: 'currentColor', borderRadius: '50%', display: 'inline-block' }} />
            </button>
          ))}
        </div>
        <div className="wb-sep" />
        <div className="wb-tool-group">
          <button className="wb-btn" disabled={!canUndo} onClick={undo} title="Undo (⌘Z)">↩</button>
          <button className="wb-btn" disabled={!canRedo} onClick={redo} title="Redo (⌘⇧Z)">↪</button>
          <button className="wb-btn" onClick={clearCanvas} title="Clear">🗑</button>
          <button className="wb-btn" onClick={exportPNG} title="Export PNG">⬇ PNG</button>
        </div>
      </div>

      {/* Canvas */}
      <div className="wb-canvas-wrap" ref={wrapRef}>
        <canvas ref={canvasRef}
          className="wb-canvas"
          style={{ cursor: tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
        {textPos && (
          <input ref={textRef} className="wb-text-input"
            style={{ left: textPos.x, top: textPos.y - 20, fontSize: width * 5 + 12, color }}
            value={textVal}
            onChange={e => setTextVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') setTextPos(null); }}
            onBlur={commitText}
          />
        )}
      </div>
    </div>
  );
}
