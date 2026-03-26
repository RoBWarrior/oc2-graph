import { useEffect, useState, useRef, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const NODE_COLORS = {
  SalesOrder: '#4f8ef7',
  Customer: '#f97316',
  Product: '#a855f7',
  Delivery: '#22c55e',
  BillingDocument: '#eab308',
  JournalEntry: '#ec4899',
  Payment: '#14b8a6',
  Plant: '#06b6d4',
};

const NODE_ICONS = {
  SalesOrder: '🛒',
  Customer: '👤',
  Product: '📦',
  Delivery: '🚚',
  BillingDocument: '🧾',
  JournalEntry: '📒',
  Payment: '💳',
  Plant: '🏭',
};

export default function App() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hi! I can help you analyze the Order-to-Cash data. Ask me anything about sales orders, deliveries, billing documents, payments, or customers.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showSQL, setShowSQL] = useState({});
  const [expandedResults, setExpandedResults] = useState({});
  const chatEndRef = useRef(null);
  const fgRef = useRef();

  // Load graph data
  useEffect(() => {
  axios.get(`${API_BASE}/api/graph`)
    .then(res => {
      const { nodes, edges } = res.data;
      setGraphData({
        nodes,
        links: edges.map(e => ({ ...e, source: e.source, target: e.target })),
      });
      // Force graph to render after data loads
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        fgRef.current?.zoomToFit(400, 40);
      }, 300);
    })
    .catch(console.error)
    .finally(() => setLoading(false));
}, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
    const connected = new Set([node.id]);
    graphData.links.forEach(link => {
      const src = link.source?.id || link.source;
      const tgt = link.target?.id || link.target;
      if (src === node.id) connected.add(tgt);
      if (tgt === node.id) connected.add(src);
    });
    setHighlightNodes(connected);
    fgRef.current?.centerAt(node.x, node.y, 500);
    fgRef.current?.zoom(3, 500);
  }, [graphData.links]);

  const sendMessage = async () => {
  const msg = chatInput.trim();
  if (!msg || chatLoading) return;

  const newMessages = [...chatMessages, { role: 'user', content: msg }];
  setChatMessages(newMessages);
  setChatInput('');
  setChatLoading(true);

  try {
    const res = await axios.post(`${API_BASE}/api/chat`, {
      message: msg,
      history: chatMessages.slice(-6),
    });

    const { answer, sql, results, error } = res.data;

    // ✅ HANDLE BACKEND ERRORS
    const finalAnswer =
      error || answer || "⚠️ No response from AI";

    setChatMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: finalAnswer,
        sql,
        results,
      },
    ]);

  } catch (err) {
    setChatMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: '❌ Network/server error.',
      },
    ]);
  } finally {
    setChatLoading(false);
  }
};

  const suggestedQueries = [
    'Which products are in the most billing documents?',
    'Show sales orders that were delivered but not billed',
    'Trace the full flow for the first billing document',
    'Which customers have the highest total order value?',
    'Show cancelled billing documents',
  ];

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      background: '#0f1117', color: '#e2e8f0',
      fontFamily: 'Inter, sans-serif', overflow: 'hidden',
    }}>

      {/* LEFT: Graph Panel */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '12px 20px', background: '#1a1d27', borderBottom: '1px solid #2d3148', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🔗</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Order-to-Cash Graph</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{graphData.nodes.length} nodes · {graphData.links.length} edges</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(NODE_COLORS).map(([type, color]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                {type.replace(/([A-Z])/g, ' $1').trim()}
              </div>
            ))}
          </div>
        </div>

        {/* Graph */}
        <div style={{ flex: 1, position: 'relative' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
              Loading graph...
            </div>
          ) : (
            <ForceGraph2D
              ref={fgRef}
              width={window.innerWidth - 420}   // ← add this
              height={window.innerHeight - 50}
              graphData={graphData}
              nodeId="id"
              nodeLabel="label"
              nodeColor={node => highlightNodes.size > 0
                ? highlightNodes.has(node.id) ? NODE_COLORS[node.type] || '#888' : '#2a2d3a'
                : NODE_COLORS[node.type] || '#888'
              }
              nodeRelSize={6}
              linkColor={() => '#2d3148'}
              linkWidth={link => {
                const src = link.source?.id || link.source;
                const tgt = link.target?.id || link.target;
                return highlightNodes.has(src) && highlightNodes.has(tgt) ? 2 : 0.5;
              }}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              onNodeClick={handleNodeClick}
              backgroundColor="#0f1117"
              nodeCanvasObject={(node, ctx, globalScale) => {
                const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node.id);
                const color = isHighlighted ? (NODE_COLORS[node.type] || '#888') : '#2a2d3a';
                const r = 6;
                ctx.beginPath();
                ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();
                if (isHighlighted && globalScale > 1.5) {
                  ctx.font = `${8 / globalScale}px Inter`;
                  ctx.fillStyle = '#e2e8f0';
                  ctx.textAlign = 'center';
                  ctx.fillText(node.label?.slice(0, 15), node.x, node.y + r + 8 / globalScale);
                }
              }}
            />
          )}

          {/* Node Detail Panel */}
          {selectedNode && (
            <div style={{
              position: 'absolute', top: 12, left: 12, background: '#1a1d27',
              border: `1px solid ${NODE_COLORS[selectedNode.type] || '#444'}`,
              borderRadius: 10, padding: 16, minWidth: 220, maxWidth: 280,
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>{NODE_ICONS[selectedNode.type]}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{selectedNode.type.replace(/([A-Z])/g, ' $1').trim()}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{selectedNode.id}</div>
                </div>
                <button onClick={() => { setSelectedNode(null); setHighlightNodes(new Set()); }}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
              {Object.entries(selectedNode)
                .filter(([k]) => !['id', 'type', 'label', 'x', 'y', 'vx', 'vy', 'fx', 'fy', 'index', '__indexColor'].includes(k))
                .map(([k, v]) => (
                  v != null && v !== '' && (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                      <span style={{ color: '#94a3b8', textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1')}</span>
                      <span style={{ color: '#e2e8f0', fontWeight: 500, maxWidth: 140, textAlign: 'right', wordBreak: 'break-all' }}>
                        {typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}
                      </span>
                    </div>
                  )
                ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Chat Panel */}
      <div style={{ width: 420, minWidth: 420, display: 'flex', flexDirection: 'column', background: '#1a1d27', borderLeft: '1px solid #2d3148', height: '100vh', overflow: 'hidden' }}>
        {/* Chat Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #2d3148' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>💬 Chat with Graph</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Ask questions about your O2C data</div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {chatMessages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%', padding: '10px 13px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: msg.role === 'user' ? '#4f8ef7' : '#252836',
                fontSize: 13, lineHeight: 1.5, color: '#e2e8f0',
              }}>
                {msg.content}
              </div>

              {/* SQL toggle */}
              {msg.sql && (
                <div style={{ maxWidth: '85%', marginTop: 6 }}>
                  <button
                    onClick={() => setShowSQL(prev => ({ ...prev, [i]: !prev[i] }))}
                    style={{ background: 'none', border: '1px solid #3d4160', borderRadius: 6, color: '#94a3b8', fontSize: 11, cursor: 'pointer', padding: '3px 8px' }}
                  >
                    {showSQL[i] ? 'Hide' : 'Show'} SQL
                  </button>
                  {showSQL[i] && (
                    <pre style={{ background: '#0f1117', border: '1px solid #2d3148', borderRadius: 6, padding: 10, fontSize: 11, color: '#a5b4fc', overflowX: 'auto', marginTop: 4, whiteSpace: 'pre-wrap' }}>
                      {msg.sql}
                    </pre>
                  )}
                </div>
              )}

              {/* Results table */}
              {msg.results && msg.results.length > 0 && (() => {
                const isExpanded = expandedResults[i];
                const allCols = Object.keys(msg.results[0]);
                const visibleCols = isExpanded ? allCols : allCols.slice(0, 5);
                const visibleRows = isExpanded ? msg.results : msg.results.slice(0, 8);
                const hasMore = !isExpanded && (msg.results.length > 8 || allCols.length > 5);

                return (
                  <div style={{ maxWidth: '100%', marginTop: 6, overflowX: 'auto' }}>
                    <table style={{ fontSize: 11, borderCollapse: 'collapse', background: '#0f1117', borderRadius: 6, overflow: 'hidden', width: '100%' }}>
                      <thead>
                        <tr>
                          {visibleCols.map(k => (
                            <th key={k} style={{ padding: '6px 8px', background: '#1a1d27', color: '#94a3b8', textAlign: 'left', borderBottom: '1px solid #2d3148', whiteSpace: 'nowrap' }}>
                              {k}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map((row, ri) => (
                          <tr key={ri}>
                            {visibleCols.map((col, vi) => (
                              <td key={vi} style={{ padding: '5px 8px', color: '#e2e8f0', borderBottom: '1px solid #1a1d27', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {row[col] == null ? '—' : String(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {hasMore && (
                      <button
                        onClick={() => setExpandedResults(prev => ({ ...prev, [i]: true }))}
                        style={{ marginTop: 4, background: 'none', border: '1px solid #3d4160', borderRadius: 6, color: '#94a3b8', fontSize: 11, cursor: 'pointer', padding: '3px 8px' }}
                      >
                        View all ({msg.results.length} rows · {allCols.length} cols)
                      </button>
                    )}
                    {isExpanded && (
                      <button
                        onClick={() => setExpandedResults(prev => ({ ...prev, [i]: false }))}
                        style={{ marginTop: 4, background: 'none', border: '1px solid #3d4160', borderRadius: 6, color: '#94a3b8', fontSize: 11, cursor: 'pointer', padding: '3px 8px' }}
                      >
                        Collapse
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}

          {chatLoading && (
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ padding: '10px 13px', borderRadius: '14px 14px 14px 4px', background: '#252836', fontSize: 13, color: '#94a3b8' }}>
                Analyzing...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Suggested Queries */}
        <div style={{ padding: '8px 14px', borderTop: '1px solid #2d3148', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {suggestedQueries.slice(0, 3).map((q, i) => (
            <button key={i} onClick={() => setChatInput(q)}
              style={{ background: '#252836', border: '1px solid #3d4160', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: '#94a3b8', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {q.length > 30 ? q.slice(0, 28) + '…' : q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid #2d3148', display: 'flex', gap: 8 }}>
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask about orders, deliveries, billing..."
            style={{
              flex: 1, background: '#252836', border: '1px solid #3d4160', borderRadius: 8,
              padding: '9px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none',
            }}
          />
          <button onClick={sendMessage} disabled={chatLoading || !chatInput.trim()}
            style={{
              background: chatLoading || !chatInput.trim() ? '#2d3148' : '#4f8ef7',
              border: 'none', borderRadius: 8, padding: '0 14px', color: '#fff',
              cursor: chatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
            }}>
            {chatLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}