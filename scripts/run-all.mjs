// เปิดทั้งระบบด้วยคำสั่งเดียว
//
// ระบบนี้มีสองตัวที่ต้องรันคู่กัน: server.js คุยกับฐานข้อมูล และ app.js เป็นหน้าเว็บ
// เดิมต้องเปิดสอง terminal แล้วสั่งคนละคำสั่ง ซึ่งเป็นเรื่องที่คนใช้งานไม่ควรต้องรู้
// (เปิดตัวเดียวแล้วหน้าเว็บจะขึ้น ECONNREFUSED โดยไม่บอกว่าเพราะอะไร)
//
// ตัวนี้เปิดให้ทั้งคู่ ผูกอายุเข้าด้วยกัน และปิดพร้อมกันเมื่อกด Ctrl+C
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const SERVICES = [
	{ name: 'api', file: 'server.js', color: '\x1b[36m' },
	{ name: 'web', file: 'app.js', color: '\x1b[32m' },
];

const RESET = '\x1b[0m';
const children = [];
let shuttingDown = false;

function launch(service) {
	const child = spawn(
		process.execPath,
		['--env-file-if-exists=.env', service.file],
		{ cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
	);

	const tag = service.color + '[' + service.name + ']' + RESET + ' ';
	const relay = (stream, out) => {
		let buffer = '';
		stream.on('data', chunk => {
			buffer += chunk.toString();
			const lines = buffer.split('\n');
			buffer = lines.pop();
			// ใส่ป้ายหน้าทุกบรรทัด จะได้รู้ว่าข้อความมาจากตัวไหน
			lines.forEach(line => out.write(tag + line + '\n'));
		});
		stream.on('end', () => { if (buffer) out.write(tag + buffer + '\n'); });
	};
	relay(child.stdout, process.stdout);
	relay(child.stderr, process.stderr);

	child.on('exit', (code, signal) => {
		if (shuttingDown) return;
		console.error(tag + 'ปิดตัวเองแล้ว (code ' + code + (signal ? ' ' + signal : '') + ')');
		// ตัวหนึ่งตาย อีกตัวก็ไม่มีประโยชน์ — ปิดให้หมดจะได้ไม่เหลือครึ่ง ๆ กลาง ๆ
		stopAll(code === 0 ? 1 : code || 1);
	});

	children.push(child);
	return child;
}

function stopAll(exitCode) {
	if (shuttingDown) return;
	shuttingDown = true;
	children.forEach(child => {
		if (!child.killed) child.kill();
	});
	setTimeout(() => process.exit(exitCode), 300);
}

// ต้องเปิด api ให้พร้อมก่อน แล้วค่อยเปิดหน้าเว็บ
//
// เปิดพร้อมกันแล้ว app.js จะยิงหา API ตั้งแต่วินาทีแรกและพ่นข้อความ
// "โหลด materials ไม่ได้ ... ECONNREFUSED" ซึ่งดูเหมือนระบบพัง ทั้งที่แค่ยังไม่ทันขึ้น
function waitReady(child, marker, timeoutMs = 20000) {
	return new Promise(resolve => {
		const done = () => { clearTimeout(timer); child.stdout.off('data', onData); resolve(); };
		const onData = chunk => { if (chunk.toString().includes(marker)) done(); };
		const timer = setTimeout(done, timeoutMs);
		child.stdout.on('data', onData);
	});
}

const api = launch(SERVICES[0]);
await waitReady(api, 'listening on API');
launch(SERVICES[1]);

process.on('SIGINT', () => {
	console.log('\nกำลังปิดระบบ...');
	stopAll(0);
});
process.on('SIGTERM', () => stopAll(0));

const webPort = process.env.PORT || 3000;
console.log('');
console.log('  เปิดระบบแล้ว — เข้าใช้งานที่  http://localhost:' + webPort);
console.log('  กด Ctrl+C เพื่อปิดทั้งระบบ');
console.log('');
