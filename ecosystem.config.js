module.exports = {
  apps: [{
    name: 'srbasar-backend',
    script: 'src/app.js',
    instances: 1,
    exec_mode: 'cluster',
    watch: true,
    ignore_watch: ['node_modules', 'logs', 'database.sqlite'],
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    env: {
      NODE_ENV: 'development',
      PORT: 3000,
      ALLOWED_ORIGINS: 'http://localhost:3000,http://localhost:8080,http://localhost:5173'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      ALLOWED_ORIGINS: 'https://yourdomain.com,https://www.yourdomain.com'
    }
  }]
};
