module.exports = {
  apps: [{
    name: 'training-management',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      PORT: 8080,
      NODE_ENV: 'production'
    }
  }]
};
