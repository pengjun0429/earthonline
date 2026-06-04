import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { io } from 'socket.io-client';
import 'leaflet/dist/leaflet.css';
import './index.css';

const SOCKET_URL = 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [myNode, setMyNode] = useState(null);
  const [globalStats, setGlobalStats] = useState({ activeUsers: 0, globalProduction: 0, socialCompression: '1.000' });
  const [lifespan, setLifespan] = useState(0);

  useEffect(() => {
    const s = io(SOCKET_URL);
    setSocket(s);

    s.on('init_data', (data) => {
      setMyNode(data);
    });

    s.on('all_nodes', (data) => {
      setNodes(data);
    });

    s.on('node_connected', (node) => {
      setNodes(prev => [...prev, node]);
    });

    s.on('node_disconnected', ({ id }) => {
      setNodes(prev => prev.filter(n => n.id !== id));
    });

    s.on('global_stats', (stats) => {
      setGlobalStats(stats);
    });

    return () => {
      s.disconnect();
    };
  }, []);

  // Lifespan timer
  useEffect(() => {
    if (!myNode) return;
    
    const interval = setInterval(() => {
      setLifespan(Math.floor((Date.now() - myNode.connectedAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [myNode]);

  // Format time HH:MM:SS
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const calculateVitalSigns = (seconds) => {
    // 10 blocks total, decreases slowly over time
    const blocks = 10;
    const decreaseRate = 3600; // 1 block per hour
    const filled = Math.max(1, blocks - Math.floor(seconds / decreaseRate));
    const empty = blocks - filled;
    return '■'.repeat(filled) + '□'.repeat(empty);
  };

  return (
    <div className="app-container">
      {/* System Header */}
      <header className="system-header">
        <div className="header-left">
          <div className="status-indicator"></div>
          <span>地球在線 // 觀測節點 [TW-X1]</span>
        </div>
        <div className="header-right">
          <span>實時連線人數: {globalStats.activeUsers}</span>
        </div>
      </header>

      <div className="main-content">
        {/* Left Metrics Terminal */}
        <aside className="metrics-terminal">
          <div className="metric-group">
            <div className="metric-title">帳號識別資訊 (SUBJECT ID)</div>
            <div className="metric-value">{myNode ? myNode.userId.substring(0, 8) : 'LOADING...'}</div>
            <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '5px'}}>
              IP: {myNode?.ip || '...'} <br/>
              REGION: {myNode?.country || '...'}
            </div>
          </div>

          <div className="metric-group">
            <div className="metric-title">系統生命週期 (LIFESPAN)</div>
            <div className="metric-value" style={{fontFamily: 'var(--font-mono)'}}>
              {formatTime(lifespan)}
            </div>
          </div>

          <div className="metric-group">
            <div className="metric-title">生物能耗值 (VITAL SIGNS)</div>
            <div className="vital-signs">
              [{calculateVitalSigns(lifespan)}]
            </div>
          </div>
        </aside>

        {/* Right Geographic Matrix */}
        <main className="geographic-matrix">
          <div className="map-overlays">
            <div className="overlay-box">
              <div className="overlay-title">世界總產出指標</div>
              <div className="overlay-value">{globalStats.globalProduction.toLocaleString()} 單位</div>
            </div>
            <div className="overlay-box" style={{borderColor: 'var(--danger-color)'}}>
              <div className="overlay-title" style={{color: 'var(--danger-color)'}}>社會總壓迫常數</div>
              <div className="overlay-value" style={{color: 'var(--danger-color)'}}>{globalStats.socialCompression} Ω</div>
            </div>
          </div>

          <MapContainer 
            center={[20, 0]} 
            zoom={2} 
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            {/* Dark Matter Base Map */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            
            {/* Node markers */}
            {nodes.map(node => (
              <CircleMarker
                key={node.id}
                center={[node.lat, node.lon]}
                radius={4}
                pathOptions={{ 
                  color: 'var(--accent-color)', 
                  fillColor: 'var(--accent-color)', 
                  fillOpacity: 0.8,
                  weight: 1
                }}
              >
                <Popup>
                  Node ID: {node.id.substring(0,8)}
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </main>
      </div>
    </div>
  );
}

export default App;
