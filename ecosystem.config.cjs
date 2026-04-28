module.exports = {
  apps: [
    {
      name: "varosh-web",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
    },
    // WhatsApp bot — Faz 5'te aktif edilecek
    // {
    //   name: "varosh-bot",
    //   script: "bot/index.js",
    //   cwd: __dirname,
    //   instances: 1,
    //   autorestart: true,
    //   watch: false,
    //   max_memory_restart: "300M",
    // },
  ],
};
