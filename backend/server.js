const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const geoip = require('geoip-lite');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// State
const connectedUsers = new Map();
let globalProduction = 0; // Total accumulated idle time (seconds)
let globalProductionBase = 0; // The base saved production when users disconnect

// Periodic global calculation
setInterval(() => {
  let currentSessionProduction = 0;
  const now = Date.now();
  
  connectedUsers.forEach(user => {
    const sessionTime = Math.floor((now - user.connectedAt) / 1000);
    currentSessionProduction += sessionTime;
  });

  globalProduction = globalProductionBase + currentSessionProduction;

  // Broadcast global stats to everyone every 2 seconds
  io.emit('global_stats', {
    activeUsers: connectedUsers.size,
    globalProduction: globalProduction,
    socialCompression: calculateSocialCompression(connectedUsers.size)
  });
}, 2000);

function calculateSocialCompression(userCount) {
  // Mock formula: more users = higher compression index
  return (1.0 + (userCount * 0.05)).toFixed(3);
}

// Function to get a mock IP if local
function getRealOrMockIP(socket) {
  let ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') {
    // Generate a random public IP for testing locally
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }
  return ip;
}

io.on('connection', (socket) => {
  const ip = getRealOrMockIP(socket);
  const geo = geoip.lookup(ip) || { country: 'UNKNOWN', ll: [0, 0] };
  
  const user = {
    id: socket.id,
    ip: ip,
    country: geo.country,
    lat: geo.ll[0],
    lon: geo.ll[1],
    connectedAt: Date.now()
  };

  connectedUsers.set(socket.id, user);

  console.log(`[SYS] Node Connected: ${socket.id} | IP: ${ip} | Region: ${user.country}`);

  // Send initial data to the connected user
  socket.emit('init_data', {
    userId: user.id,
    ip: user.ip,
    country: user.country,
    lat: user.lat,
    lon: user.lon,
    connectedAt: user.connectedAt,
    activeUsers: connectedUsers.size
  });

  // Broadcast the new node to all clients for heatmap updating
  io.emit('node_connected', {
    id: user.id,
    lat: user.lat,
    lon: user.lon
  });

  // Also send all current nodes to the new client
  const allNodes = Array.from(connectedUsers.values()).map(u => ({
    id: u.id,
    lat: u.lat,
    lon: u.lon
  }));
  socket.emit('all_nodes', allNodes);

  socket.on('disconnect', () => {
    const disconnectedUser = connectedUsers.get(socket.id);
    if (disconnectedUser) {
      const sessionTime = Math.floor((Date.now() - disconnectedUser.connectedAt) / 1000);
      globalProductionBase += sessionTime; // Add their contribution to the base
      connectedUsers.delete(socket.id);
      
      console.log(`[SYS] Node Disconnected: ${socket.id} | Lifespan: ${sessionTime}s`);
      
      io.emit('node_disconnected', { id: socket.id });
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[SYS] Earth Online Backend Core initialized on port ${PORT}`);
});
