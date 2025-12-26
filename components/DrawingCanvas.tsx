import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Trash2, Undo2, Eraser } from 'lucide-react';
import { COLORS } from '../types';

interface DrawingCanvasProps {
  onUpdate: (base64: string) => void;
  disabled: boolean;
  currentColor: string;
  onColorChange: (color: string) => void;
  initialData?: string | null;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ onUpdate, disabled, currentColor, onColorChange, initialData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [lineWidth, setLineWidth] = useState(5);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  
  // Track last position for efficient segment drawing
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  
  // Ref for debounce timer
  const updateTimeoutRef = useRef<number | null>(null);

  // Debounced update function
  const debouncedUpdate = useCallback((canvas: HTMLCanvasElement) => {
    if (updateTimeoutRef.current) {
      window.clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = window.setTimeout(() => {
      onUpdate(canvas.toDataURL());
    }, 200);
  }, [onUpdate]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        window.clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);
  
  // Initialize canvas and handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateSize = () => {
      // Save current content before resize
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) tempCtx.drawImage(canvas, 0, 0);

      canvas.width = container.offsetWidth;
      canvas.height = container.offsetHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Restore content if any existed
        if (tempCanvas.width > 0 && tempCanvas.height > 0) {
             ctx.drawImage(tempCanvas, 0, 0);
        }
      }
      setHistory([]); // Clear history to prevent undo bugs with resized ImageData
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Handle Initial Data Load (Persistence)
  useEffect(() => {
    if (initialData && canvasRef.current) {
        const img = new Image();
        img.onload = () => {
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
            }
        };
        img.src = initialData;
    }
  }, []); // Only on mount

  // Save history helper
  const saveState = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory(prev => [...prev.slice(-10), imageData]); // Keep last 10
      onUpdate(canvas.toDataURL());
    }
  };

  // Restore history
  const handleUndo = () => {
    if (history.length === 0 || disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      const newHistory = [...history];
      const previousState = newHistory.pop(); 
      
      setHistory(newHistory);

      if (previousState) {
        ctx.putImageData(previousState, 0, 0);
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      // Immediate update for Undo
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      onUpdate(canvas.toDataURL());
    }
  };

  const handleClear = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      saveState(); 
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Immediate update for Clear
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      onUpdate(canvas.toDataURL());
    }
  };

  // Drawing Handlers
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    setIsDrawing(true);
    saveState(); 

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { clientX, clientY } = 'touches' in e ? e.touches[0] : e as React.MouseEvent;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    lastPos.current = { x, y };

    ctx.beginPath();
    ctx.moveTo(x, y);
    
    if (tool === 'eraser') {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = lineWidth * 2; 
    } else {
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = lineWidth;
    }
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw a single dot to represent the start
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled || !lastPos.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { clientX, clientY } = 'touches' in e ? e.touches[0] : e as React.MouseEvent;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Draw segment from last position to current
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();

    lastPos.current = { x, y };

    // Debounced update during drawing
    debouncedUpdate(canvas);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      // Cancel any pending debounced updates and trigger immediate update on stop
      if (updateTimeoutRef.current) {
        window.clearTimeout(updateTimeoutRef.current);
      }
      onUpdate(canvas.toDataURL());
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-2xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden border-4 border-violet-700">
      
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 bg-violet-100 border-b border-violet-200">
        <div className="flex gap-1 overflow-x-auto pb-1 max-w-[50%] scrollbar-hide">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => {
                onColorChange(c);
                setTool('pen'); 
              }}
              className={`w-8 h-8 rounded-full border-2 flex-shrink-0 transition-transform ${currentColor === c && tool === 'pen' ? 'border-black scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
        <div className="flex gap-2 items-center">
            {/* Brush Size Toggle */}
            <button 
                onClick={() => setLineWidth(lineWidth === 5 ? 15 : 5)} 
                className={`p-2 rounded hover:bg-violet-200 ${lineWidth > 5 ? 'bg-violet-300' : ''}`}
                title="Toggle Brush Size"
            >
                <div className="bg-black rounded-full" style={{ width: lineWidth > 5 ? 12 : 6, height: lineWidth > 5 ? 12 : 6 }} />
            </button>

            {/* Eraser Tool */}
            <button 
                onClick={() => setTool(t => t === 'eraser' ? 'pen' : 'eraser')}
                className={`p-2 rounded transition-colors ${tool === 'eraser' ? 'bg-violet-600 text-white' : 'text-violet-800 hover:bg-violet-200'}`}
                title={tool === 'eraser' ? "Switch to Pen" : "Eraser"}
            >
                <Eraser size={20} />
            </button>

            <div className="w-px h-6 bg-violet-300 mx-1"></div>

            <button 
                onClick={handleUndo} 
                disabled={history.length === 0}
                className={`p-2 rounded ${history.length === 0 ? 'text-gray-400 cursor-not-allowed' : 'text-violet-800 hover:bg-violet-200'}`} 
                title="Undo"
            >
                <Undo2 size={20} />
            </button>
            <button onClick={handleClear} className="p-2 text-red-600 hover:bg-red-100 rounded" title="Clear All">
                <Trash2 size={20} />
            </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef} 
        className="flex-1 relative cursor-crosshair touch-none bg-white"
        style={{ minHeight: '300px' }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full block"
        />
        {disabled && (
          <div className="absolute inset-0 bg-black/10 cursor-not-allowed flex items-center justify-center">
            {/* Optional overlay content */}
          </div>
        )}
      </div>
    </div>
  );
};