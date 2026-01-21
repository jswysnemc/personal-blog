import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import Vditor from 'vditor';

interface Props {
  children: string;
}

const MERMAID_FONT_FAMILY = '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Source Han Sans SC", "Heiti SC", "Outfit", ui-sans-serif, system-ui, sans-serif';
const MERMAID_PADDING = 48;
const MIN_SCALE = 0.5;
const MAX_SCALE = 1.3;
const TARGET_TEXT_HEIGHT = 14;
const TARGET_NODE_HEIGHT = 36;

// Fullscreen zoom/pan constants
const FS_MIN_ZOOM = 0.25;
const FS_MAX_ZOOM = 4;
const FS_ZOOM_STEP = 0.25;
const VDITOR_CDN = '/vditor';

function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return isDark;
}

const MermaidBlock = memo(function MermaidBlock({ children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const lastContainerWidth = useRef<number | null>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });
  const isDark = useIsDarkMode();

  // Fullscreen zoom and pan state
  const [fsZoom, setFsZoom] = useState(1);
  const [fsPan, setFsPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const fsContainerRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'success' | 'error'>('idle');

  // Copy diagram as image to clipboard
  const handleCopyAsImage = useCallback(async () => {
    if (!svg || copyStatus === 'copying') return;

    setCopyStatus('copying');
    try {
      const svgElement = svgContainerRef.current?.querySelector('svg');
      if (!svgElement) throw new Error('SVG not found');

      // Clone and prepare SVG for export
      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

      // Get dimensions
      const bbox = svgElement.getBBox();
      const width = svgSize.width || bbox.width || 800;
      const height = svgSize.height || bbox.height || 600;

      // Set explicit dimensions on cloned SVG
      clonedSvg.setAttribute('width', String(width));
      clonedSvg.setAttribute('height', String(height));

      // Add white background rect
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('width', '100%');
      bgRect.setAttribute('height', '100%');
      bgRect.setAttribute('fill', '#ffffff');
      clonedSvg.insertBefore(bgRect, clonedSvg.firstChild);

      // Serialize and encode as base64 data URL
      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const base64 = btoa(unescape(encodeURIComponent(svgData)));
      const dataUrl = `data:image/svg+xml;base64,${base64}`;

      // Create canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      const pixelRatio = 2;
      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;
      ctx.scale(pixelRatio, pixelRatio);

      const img = new Image();
      img.onload = async () => {
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(async (blob) => {
          if (!blob) {
            setCopyStatus('error');
            setTimeout(() => setCopyStatus('idle'), 2000);
            return;
          }

          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            setCopyStatus('success');
            setTimeout(() => setCopyStatus('idle'), 2000);
          } catch {
            setCopyStatus('error');
            setTimeout(() => setCopyStatus('idle'), 2000);
          }
        }, 'image/png');
      };

      img.onerror = () => {
        setCopyStatus('error');
        setTimeout(() => setCopyStatus('idle'), 2000);
      };

      img.src = dataUrl;
    } catch {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  }, [svg, svgSize, copyStatus]);

  // Download diagram as image
  const handleDownloadImage = useCallback(async () => {
    if (!svg) return;

    try {
      const svgElement = svgContainerRef.current?.querySelector('svg');
      if (!svgElement) return;

      // Clone and prepare SVG for export
      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

      // Get dimensions
      const bbox = svgElement.getBBox();
      const width = svgSize.width || bbox.width || 800;
      const height = svgSize.height || bbox.height || 600;

      // Set explicit dimensions on cloned SVG
      clonedSvg.setAttribute('width', String(width));
      clonedSvg.setAttribute('height', String(height));

      // Add white background rect
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('width', '100%');
      bgRect.setAttribute('height', '100%');
      bgRect.setAttribute('fill', '#ffffff');
      clonedSvg.insertBefore(bgRect, clonedSvg.firstChild);

      // Serialize and encode as base64 data URL
      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const base64 = btoa(unescape(encodeURIComponent(svgData)));
      const dataUrl = `data:image/svg+xml;base64,${base64}`;

      // Create canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const pixelRatio = 2;
      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;
      ctx.scale(pixelRatio, pixelRatio);

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);

        // Create download link
        const link = document.createElement('a');
        link.download = `mermaid-diagram-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      };

      img.src = dataUrl;
    } catch {
      // Silent fail for download
    }
  }, [svg, svgSize]);

  useEffect(() => {
    let cancelled = false;
    let frameId = 0;
    const code = children.trim();

    setError('');
    setSvg('');
    setSvgSize({ width: 0, height: 0 });

    if (!code) {
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    const renderRoot = document.createElement('div');
    const mermaidElement = document.createElement('div');
    mermaidElement.className = 'language-mermaid';
    mermaidElement.textContent = code;
    renderRoot.appendChild(mermaidElement);

    Vditor.mermaidRender(renderRoot, VDITOR_CDN, isDark ? 'dark' : 'light');

    const start = performance.now();
    const checkSvg = () => {
      if (cancelled) return;
      const svgElement = mermaidElement.querySelector('svg');
      if (svgElement) {
        setSvg(svgElement.outerHTML);
        setLoading(false);
        return;
      }
      if (performance.now() - start > 3000) {
        setLoading(false);
        setError('Failed to render diagram');
        return;
      }
      frameId = requestAnimationFrame(checkSvg);
    };

    frameId = requestAnimationFrame(checkSvg);

    return () => {
      cancelled = true;
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [children, isDark]);

  useEffect(() => {
    if (!svgContainerRef.current) return;
    svgContainerRef.current.innerHTML = svg;
  }, [svg]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setPortalTarget(document.body);
    }
  }, []);

  useEffect(() => {
    if (!portalTarget || !isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen, portalTarget]);

  // Calculate scale after SVG is rendered
  useEffect(() => {
    if (!svg || !svgContainerRef.current || !containerRef.current) return;
    lastContainerWidth.current = null;

    const calculateScale = () => {
      const svgElement = svgContainerRef.current?.querySelector('svg');
      if (!svgElement) return;

      const containerWidth = containerRef.current?.clientWidth || 600;
      if (lastContainerWidth.current !== null && Math.abs(lastContainerWidth.current - containerWidth) < 0.5) {
        return;
      }
      lastContainerWidth.current = containerWidth;
      const viewBox = svgElement.viewBox?.baseVal;
      const viewBoxWidth = viewBox?.width || 0;
      const viewBoxHeight = viewBox?.height || 0;
      const attrWidth = parseFloat(svgElement.getAttribute('width') || '0') || 0;
      const attrHeight = parseFloat(svgElement.getAttribute('height') || '0') || 0;
      const measuredWidth = svgElement.getBoundingClientRect().width || 0;
      const measuredHeight = svgElement.getBoundingClientRect().height || 0;
      const svgWidth = viewBoxWidth || attrWidth || (scale ? measuredWidth / scale : measuredWidth);
      const svgHeight = viewBoxHeight || attrHeight || (scale ? measuredHeight / scale : measuredHeight);
      if (!svgWidth || !Number.isFinite(svgWidth)) return;

      const getMedian = (values: number[]) => {
        if (!values.length) return null;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
      };

      const collectHeights = (elements: Element[]) => {
        const heights: number[] = [];
        elements.forEach(el => {
          if (typeof (el as SVGGraphicsElement).getBBox !== 'function') return;
          try {
            const box = (el as SVGGraphicsElement).getBBox();
            if (Number.isFinite(box.height) && box.height > 0) {
              heights.push(box.height);
            }
          } catch {
            // Ignore elements that cannot be measured
          }
        });
        return heights;
      };

      const labelCandidates = Array.from(
        svgElement.querySelectorAll('text, foreignObject')
      ).filter(el => {
        if (el.tagName.toLowerCase() !== 'text') return true;
        const textContent = el.textContent?.trim();
        return Boolean(textContent);
      });

      const nodeCandidates = Array.from(
        svgElement.querySelectorAll('.node rect, .node polygon, .node ellipse, .node circle, .actor rect, .note rect, .statediagram-state rect, .state rect, .classGroup rect')
      );

      const labelMedian = getMedian(collectHeights(labelCandidates));
      const nodeMedian = getMedian(collectHeights(nodeCandidates));

      const visualScale = labelMedian
        ? TARGET_TEXT_HEIGHT / labelMedian
        : nodeMedian
          ? TARGET_NODE_HEIGHT / nodeMedian
          : null;

      // Scale within bounds so diagrams are readable but not oversized
      const availableWidth = Math.max(0, containerWidth - MERMAID_PADDING);
      const fitScale = availableWidth / svgWidth;
      const targetScale = visualScale ?? fitScale;
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(fitScale, targetScale)));
      if (Number.isFinite(nextScale)) {
        setScale(prev => (Math.abs(prev - nextScale) > 0.002 ? nextScale : prev));
      } else {
        setScale(prev => (prev !== 1 ? 1 : prev));
      }
      if (Number.isFinite(svgWidth) && Number.isFinite(svgHeight)) {
        setSvgSize(prev => {
          if (Math.abs(prev.width - svgWidth) < 0.5 && Math.abs(prev.height - svgHeight) < 0.5) {
            return prev;
          }
          return { width: svgWidth, height: svgHeight };
        });
      }
    };

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      calculateScale();
    });

    // Recalculate on window resize
    const handleResize = () => calculateScale();
    window.addEventListener('resize', handleResize);
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => calculateScale())
      : null;
    const containerElement = containerRef.current;
    if (resizeObserver && containerElement) {
      resizeObserver.observe(containerElement);
    }
    if ('fonts' in document && document.fonts?.ready) {
      document.fonts.ready.then(() => calculateScale());
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
    };
  }, [svg]);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      // Reset zoom and pan when opening
      setFsZoom(1);
      setFsPan({ x: 0, y: 0 });
    }
    setIsFullscreen(!isFullscreen);
  };

  useEffect(() => {
    if (!isFullscreen || !fsContainerRef.current || !svgSize.width || !svgSize.height) return;
    const { clientWidth, clientHeight } = fsContainerRef.current;
    const fitZoom = Math.min(clientWidth / svgSize.width, clientHeight / svgSize.height);
    const clamped = Math.min(FS_MAX_ZOOM, Math.max(FS_MIN_ZOOM, fitZoom));
    setFsZoom(clamped);
    setFsPan({ x: 0, y: 0 });
  }, [isFullscreen, svgSize.width, svgSize.height]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setFsZoom(z => Math.min(FS_MAX_ZOOM, z + FS_ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setFsZoom(z => Math.max(FS_MIN_ZOOM, z - FS_ZOOM_STEP));
  }, []);

  const handleResetView = useCallback(() => {
    setFsZoom(1);
    setFsPan({ x: 0, y: 0 });
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -FS_ZOOM_STEP : FS_ZOOM_STEP;
    setFsZoom(z => Math.min(FS_MAX_ZOOM, Math.max(FS_MIN_ZOOM, z + delta)));
  }, []);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - fsPan.x, y: e.clientY - fsPan.y });
  }, [fsPan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setFsPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isFullscreen || !fsContainerRef.current) return;
    const target = fsContainerRef.current;
    const onWheel = (event: WheelEvent) => handleWheel(event);
    target.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      target.removeEventListener('wheel', onWheel);
    };
  }, [isFullscreen, handleWheel]);

  const fullscreenModal = isFullscreen ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={toggleFullscreen}
    >
      {/* Minimal semi-transparent backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Adaptive modal window with max constraints */}
      <div
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col"
        style={{ width: '1000px', maxWidth: '95vw', maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header with zoom controls */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-pink-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Mermaid Diagram
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
              {Math.round(fsZoom * 100)}%
            </span>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomOut}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
              title="Zoom out"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <button
              onClick={handleResetView}
              className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
              title="Reset view"
            >
              Reset
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
              title="Zoom in"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1" />
            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
              title="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Diagram container with pan/zoom */}
        <div
          ref={fsContainerRef}
          className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
          style={{ minHeight: '400px' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <div className="w-full h-full flex items-center justify-center">
            <div
              style={{
                transform: `translate(${fsPan.x}px, ${fsPan.y}px)`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              }}
            >
              <div
                style={{
                  transform: `scale(${fsZoom})`,
                  transformOrigin: 'center center',
                }}
              >
                <div
                  className="mermaid-svg-fullscreen"
                  style={{
                    width: svgSize.width ? `${svgSize.width}px` : undefined,
                    height: svgSize.height ? `${svgSize.height}px` : undefined,
                  }}
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Hint text */}
        <div className="shrink-0 px-4 py-2 text-center text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800">
          Scroll to zoom, drag to pan
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div
        ref={containerRef}
        className="mermaid-block my-6 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-pink-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 font-mono">
              mermaid
            </span>
            {scale !== 1 && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                ({Math.round(scale * 100)}%)
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopyAsImage}
              disabled={copyStatus === 'copying' || !svg}
              className={`p-1.5 rounded-md transition-colors ${
                copyStatus === 'success'
                  ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                  : copyStatus === 'error'
                  ? 'text-red-500 bg-red-50 dark:bg-red-900/30'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title={copyStatus === 'success' ? 'Copied!' : copyStatus === 'error' ? 'Failed to copy' : 'Copy as image'}
            >
              {copyStatus === 'copying' ? (
                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              ) : copyStatus === 'success' ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            <button
              onClick={handleDownloadImage}
              disabled={!svg}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors disabled:opacity-50"
              title="Download as image"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
              title="View fullscreen"
            >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-slate-400 min-h-[120px]">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              <span className="text-sm">Rendering diagram...</span>
            </div>
          ) : error ? (
            <div className="text-red-500 text-sm p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="font-medium mb-1">Diagram Error</div>
              <code className="text-xs">{error}</code>
            </div>
          ) : (
            <div className="mermaid-svg-outer flex justify-center">
              <div
                ref={svgContainerRef}
                className="mermaid-svg"
                style={{
                  width: svgSize.width ? `${svgSize.width * scale}px` : undefined,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Modal */}
      {portalTarget ? (fullscreenModal ? createPortal(fullscreenModal, portalTarget) : null) : fullscreenModal}

      <style>{`
        .mermaid-svg-outer {
          width: 100%;
        }
        .mermaid-svg {
          display: inline-block;
        }
        .mermaid-svg svg {
          width: 100% !important;
          height: auto !important;
        }
        .mermaid-svg-fullscreen {
          display: flex;
          align-items: center;
          justify-content: center;
          user-select: none;
        }
        .mermaid-svg-fullscreen svg {
          width: 100% !important;
          height: 100% !important;
        }
        .mermaid-svg foreignObject,
        .mermaid-svg-fullscreen foreignObject {
          overflow: visible !important;
        }
        .mermaid-svg text,
        .mermaid-svg-fullscreen text,
        .mermaid-svg .label,
        .mermaid-svg .label *,
        .mermaid-svg-fullscreen .label,
        .mermaid-svg-fullscreen .label * {
          font-family: ${MERMAID_FONT_FAMILY} !important;
        }
        .mermaid-svg .label,
        .mermaid-svg-fullscreen .label {
          line-height: 1.35;
        }
        .mermaid-svg .node rect,
        .mermaid-svg .node circle,
        .mermaid-svg .node ellipse,
        .mermaid-svg .node polygon,
        .mermaid-svg-fullscreen .node rect,
        .mermaid-svg-fullscreen .node circle,
        .mermaid-svg-fullscreen .node ellipse,
        .mermaid-svg-fullscreen .node polygon {
          stroke-width: 2px;
        }
        .mermaid-svg .edgeLabel,
        .mermaid-svg-fullscreen .edgeLabel {
          opacity: 1 !important;
        }
        .mermaid-svg .edgeLabel .label,
        .mermaid-svg-fullscreen .edgeLabel .label {
          line-height: 1 !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .mermaid-svg .edgeLabel text,
        .mermaid-svg-fullscreen .edgeLabel text {
          text-anchor: middle;
          dominant-baseline: central;
        }
        .mermaid-svg .edgeLabel,
        .mermaid-svg .edgeLabel .label,
        .mermaid-svg-fullscreen .edgeLabel,
        .mermaid-svg-fullscreen .edgeLabel .label {
          color: #0f172a !important;
        }
        .mermaid-svg .edgeLabel text,
        .mermaid-svg-fullscreen .edgeLabel text {
          fill: #0f172a !important;
          opacity: 1 !important;
        }
        .dark .mermaid-svg .edgeLabel,
        .dark .mermaid-svg-fullscreen .edgeLabel {
          background-color: #1e293b;
        }
        .dark .mermaid-svg .edgeLabel,
        .dark .mermaid-svg .edgeLabel .label,
        .dark .mermaid-svg-fullscreen .edgeLabel,
        .dark .mermaid-svg-fullscreen .edgeLabel .label {
          color: #e2e8f0 !important;
        }
        .dark .mermaid-svg-fullscreen text {
          fill: #e6edf3 !important;
        }
        .dark .mermaid-svg-fullscreen .node rect,
        .dark .mermaid-svg-fullscreen .node circle,
        .dark .mermaid-svg-fullscreen .node ellipse,
        .dark .mermaid-svg-fullscreen .node polygon,
        .dark .mermaid-svg-fullscreen .node path {
          stroke: #64748b !important;
        }
        .dark .mermaid-svg-fullscreen .edgePath .path {
          stroke: #94a3b8 !important;
        }
        .dark .mermaid-svg-fullscreen .cluster rect {
          fill: #1e293b !important;
          stroke: #475569 !important;
        }
        /* Actor boxes in sequence diagrams */
        .mermaid-svg .actor,
        .mermaid-svg-fullscreen .actor {
          stroke-width: 2px;
        }
        .mermaid-svg .messageText,
        .mermaid-svg-fullscreen .messageText {
          font-size: 14px !important;
        }
        .mermaid-svg .labelText,
        .mermaid-svg-fullscreen .labelText {
          font-size: 14px !important;
        }
        .mermaid-svg .loopText,
        .mermaid-svg-fullscreen .loopText {
          font-size: 13px !important;
        }
        .mermaid-svg .noteText,
        .mermaid-svg-fullscreen .noteText {
          font-size: 13px !important;
        }
        /* Gantt chart */
        .mermaid-svg .taskText,
        .mermaid-svg-fullscreen .taskText {
          font-size: 12px !important;
        }
        .mermaid-svg .sectionTitle,
        .mermaid-svg-fullscreen .sectionTitle {
          font-size: 14px !important;
          font-weight: 600;
        }
        /* Pie chart */
        .mermaid-svg .pieTitleText,
        .mermaid-svg-fullscreen .pieTitleText {
          font-size: 18px !important;
          font-weight: 600;
        }
        .mermaid-svg .slice,
        .mermaid-svg-fullscreen .slice {
          font-size: 14px !important;
        }
        /* State diagram */
        .mermaid-svg .statediagram-state rect,
        .mermaid-svg-fullscreen .statediagram-state rect {
          rx: 8px;
          ry: 8px;
        }
        /* Class diagram */
        .mermaid-svg .classLabel .box,
        .mermaid-svg-fullscreen .classLabel .box {
          stroke-width: 2px;
        }
      `}</style>
    </>
  );
});

export default MermaidBlock;
