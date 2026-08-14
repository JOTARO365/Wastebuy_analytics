// pm2 ต้องรัน 2 process ไม่ใช่ตัวเดียว: server.js เป็น API ที่คุยกับ Postgres
// ส่วน app.js เป็นหน้าเว็บที่เรียก API นั้น ถ้าขาดตัวใดตัวหนึ่ง nginx จะขึ้น 502
//
//   pm2 start ecosystem.config.cjs
//   pm2 logs --lines 40
//   pm2 save
//
// ค่าจริงของ DB ตั้งที่นี่ หรือ export ไว้ก่อนสั่ง pm2 start ก็ได้
const path = require('path');

const shared = {
    cwd: __dirname,
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    max_restarts: 10,
    // DB ล่ม = server.js จบด้วย exit 1 ทันที ถ้า restart รัวจะไม่มีใครเห็น log
    restart_delay: 3000,
    env: {
        NODE_ENV: 'production',
        PORT: 3000,
        API_PORT: 4000,
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_NAME: 'wastebuy-analytics',
        DB_USER: 'postgres',
        DB_PASSWORD: process.env.DB_PASSWORD || 'admin',
    },
};

module.exports = {
    apps: [
        {
            ...shared,
            name: 'wastebuy-api',
            script: path.join(__dirname, 'server.js'),
            error_file: path.join(__dirname, 'logs', 'api.err.log'),
            out_file: path.join(__dirname, 'logs', 'api.out.log'),
        },
        {
            ...shared,
            name: 'wastebuy-web',
            script: path.join(__dirname, 'app.js'),
            error_file: path.join(__dirname, 'logs', 'web.err.log'),
            out_file: path.join(__dirname, 'logs', 'web.out.log'),
        },
    ],
};
