const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb');
// Metro is reachable by the phone on the LAN. It must never serve engine photos,
// keys, private runtime files or captures as development assets/source files.
const privatePath = /(?:^|[\\/=?&])(?:\.data|\.runtime|\.git|\.codex|\.agents|work|graphify-out|\.env[^\\/?&]*)(?:[\\/?&#]|$)/i;
const previousMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const nextMiddleware = previousMiddleware ? previousMiddleware(middleware, server) : middleware;
  return (req, res, next) => {
    let path = req.url || '/';
    try { for (let index = 0; index < 3; index++) { const decoded = decodeURIComponent(path); if (decoded === path) break; path = decoded; } }
    catch { res.statusCode = 400; res.end('Invalid path.'); return; }
    if (privatePath.test(path)) { res.statusCode = 403; res.setHeader('Cache-Control', 'no-store'); res.end('Private Thread files are unavailable through the development server.'); return; }
    nextMiddleware(req, res, next);
  };
};
module.exports = config;
