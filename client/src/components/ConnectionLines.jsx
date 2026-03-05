import { useState, useEffect, useRef } from 'react';
import './ConnectionLines.css';

export default function ConnectionLines({ connections, documents, canvasRef, onRemoveConnection }) {
  const [lines, setLines] = useState([]);
  const svgRef = useRef(null);

  // Recalculate line positions when connections or documents change
  useEffect(() => {
    if (!canvasRef.current || connections.length === 0) {
      setLines([]);
      return;
    }

    const updateLines = () => {
      const newLines = connections.map(conn => {
        const sourceDoc = documents.find(d => d.id === conn.sourceDocId);
        const targetDoc = documents.find(d => d.id === conn.targetDocId);
        if (!sourceDoc || !targetDoc) return null;

        // Source: right edge center of source doc card
        const sx = sourceDoc.position.x + 400; // card width
        const sy = sourceDoc.position.y + 50; // approximate header center

        // Try to find the element position more accurately
        const elementEl = document.querySelector(`[data-element-id="${conn.elementId}"]`);
        let esx = sx;
        let esy = sy;
        if (elementEl && canvasRef.current) {
          const canvasRect = canvasRef.current.getBoundingClientRect();
          const elRect = elementEl.getBoundingClientRect();
          esx = elRect.right - canvasRect.left + canvasRef.current.scrollLeft;
          esy = elRect.top + elRect.height / 2 - canvasRect.top + canvasRef.current.scrollTop;
        }

        // Target: left edge center of target doc card
        const tx = targetDoc.position.x;
        const ty = targetDoc.position.y + 50;

        return {
          id: conn.id,
          x1: esx,
          y1: esy,
          x2: tx,
          y2: ty,
          label: conn.element?.label?.slice(0, 30) || 'Connection',
        };
      }).filter(Boolean);

      setLines(newLines);
    };

    updateLines();
    // Update on animation frame for smooth following during drags
    const interval = setInterval(updateLines, 100);
    return () => clearInterval(interval);
  }, [connections, documents, canvasRef]);

  if (lines.length === 0) return null;

  return (
    <svg ref={svgRef} className="connection-lines">
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="rgba(187, 128, 255, 0.5)" />
        </marker>
      </defs>
      {lines.map(line => {
        // Bezier control points for a nice curve
        const dx = Math.abs(line.x2 - line.x1);
        const cp = Math.max(80, dx * 0.4);

        const pathD = `M ${line.x1} ${line.y1} C ${line.x1 + cp} ${line.y1}, ${line.x2 - cp} ${line.y2}, ${line.x2} ${line.y2}`;
        const midX = (line.x1 + line.x2) / 2;
        const midY = (line.y1 + line.y2) / 2;

        return (
          <g key={line.id} className="connection-line-group">
            {/* Shadow/glow path */}
            <path
              d={pathD}
              fill="none"
              stroke="rgba(187, 128, 255, 0.08)"
              strokeWidth="8"
            />
            {/* Main path */}
            <path
              d={pathD}
              fill="none"
              stroke="rgba(187, 128, 255, 0.4)"
              strokeWidth="2"
              strokeDasharray="6 4"
              markerEnd="url(#arrowhead)"
              className="connection-line-path"
            />
            {/* Delete button at midpoint */}
            <g
              className="connection-line-delete"
              onClick={(e) => { e.stopPropagation(); onRemoveConnection(line.id); }}
              transform={`translate(${midX}, ${midY})`}
            >
              <circle r="10" fill="#1e2030" stroke="rgba(187, 128, 255, 0.3)" strokeWidth="1" />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fill="rgba(187, 128, 255, 0.6)"
                fontSize="12"
                fontWeight="bold"
                style={{ cursor: 'pointer' }}
              >
                ×
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
