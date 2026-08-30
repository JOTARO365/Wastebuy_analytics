// หน้า งานประจำ — ปฏิทิน + CRUD งานประจำ/นัด
//
// endpoint ทั้งหมดอยู่ที่ server.js (:4000) แต่หน้าเว็บอยู่ :3000 คนละ origin
// จึงยิงผ่าน path เดียวกันกับหน้าเว็บไม่ได้ ต้องผ่าน proxy ที่ app.js เปิดให้
(function () {
    const holder = document.getElementById('recurring-payload');
    const calEl = document.getElementById('calendar');
    if (!holder || !calEl) return;

    const data = JSON.parse(holder.textContent);
    const jobModal = new bootstrap.Modal(document.getElementById('job-modal'));
    const slotModal = new bootstrap.Modal(document.getElementById('slot-modal'));

    const holidayByDate = new Map(
        (data.holidays || []).map(h => [h.holiday_date, h.holiday_name]));
    const slotsByDate = new Map();
    (data.schedule || []).forEach(function (row) {
        const key = String(row.scheduled_date).slice(0, 10);
        if (!slotsByDate.has(key)) slotsByDate.set(key, []);
        slotsByDate.get(key).push(row);
    });

    // นัดที่แนะนำจากเดือนก่อน — ยังไม่อยู่ในฐาน วาดเป็นเส้นประ
    const draftsByDate = new Map();
    (data.suggestions || []).forEach(function (row) {
        const key = row.suggested_date;
        if (!draftsByDate.has(key)) draftsByDate.set(key, []);
        draftsByDate.get(key).push(row);
    });

    async function callApi(method, path, body) {
        const res = await fetch('/api/recurring' + path, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });
        const json = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(json.error || ('HTTP ' + res.status));
        return json;
    }

    // ── ปฏิทิน ──────────────────────────────────────────────
    function isoDate(year, month, day) {
        return year + '-' + String(month).padStart(2, '0') + '-' +
               String(day).padStart(2, '0');
    }

    function drawCalendar() {
        const [year, month] = data.month.split('-').map(Number);
        const first = new Date(year, month - 1, 1);
        const daysInMonth = new Date(year, month, 0).getDate();
        // getDay() คืน 0=อาทิตย์ แต่ปฏิทินไทยเริ่มจันทร์ — เลื่อนให้จันทร์เป็น 0
        const lead = (first.getDay() + 6) % 7;
        const today = new Date().toISOString().slice(0, 10);

        let html = '';
        ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'].forEach(function (name) {
            html += '<div class="head">' + name + '</div>';
        });

        for (let i = 0; i < lead; i++) html += '<div class="day is-out"></div>';

        for (let day = 1; day <= daysInMonth; day++) {
            const date = isoDate(year, month, day);
            const weekday = new Date(year, month - 1, day).getDay();
            const isWeekend = weekday === 0 || weekday === 6;
            const holiday = holidayByDate.get(date);
            const classes = ['day'];
            if (isWeekend || holiday) classes.push('is-holiday');
            if (date === today) classes.push('is-today');

            html += '<div class="' + classes.join(' ') + '" data-date="' + date + '">' +
                '<div class="num">' + day +
                '<button type="button" class="add no-print" data-add="' + date +
                '" title="เพิ่มนัด">+</button>' +
                (holiday ? '<span class="tag"> ' + holiday + '</span>' : '') +
                '</div>';

            (slotsByDate.get(date) || []).forEach(function (slot) {
                const state = slot.job_deleted ? 'is-orphan'
                    : slot.status === 'สำเร็จ' ? 'is-done'
                    : slot.status === 'ยกเลิก' ? 'is-cancel' : '';
                html += '<span class="pin ' + state + '" data-slot="' + slot.id + '">' +
                    '<b>' + slot.job_name_snapshot + '</b>' +
                    '<small>' + (slot.driver || 'ยังไม่มีคนขับ') +
                    (slot.total_baht ? ' · ' + Math.round(slot.total_baht).toLocaleString() + '฿' : '') +
                    '</small></span>';
            });

            (draftsByDate.get(date) || []).forEach(function (draft) {
                html += '<span class="pin is-draft' +
                    (draft.shifted ? ' was-shifted' : '') + '"' +
                    ' title="แนะนำจากเดือนก่อน (ล่าสุด ' + draft.last_date + ')' +
                    (draft.shifted
                        ? ' — เลื่อนจาก ' + draft.planned_date +
                          (draft.planned_holiday ? ' (' + draft.planned_holiday + ')' : '')
                        : '') + '">' +
                    '<b>' + draft.job_name + '</b>' +
                    '<small>ร่าง · ' + (draft.driver || 'ยังไม่มีคนขับ') + '</small></span>';
            });

            html += '</div>';
        }

        const tail = (7 - ((lead + daysInMonth) % 7)) % 7;
        for (let i = 0; i < tail; i++) html += '<div class="day is-out"></div>';

        calEl.innerHTML = html;
    }

    drawCalendar();

    // ── งานประจำ ────────────────────────────────────────────
    let chosen = new Set();

    function renderChosen() {
        const box = document.getElementById('chosen-members');
        box.innerHTML = '';
        [...chosen].sort().forEach(function (name) {
            const tag = document.createElement('span');
            tag.textContent = name + ' ✕';
            tag.style.cursor = 'pointer';
            tag.addEventListener('click', function () {
                chosen.delete(name);
                renderChosen();
                const box2 = document.querySelector(
                    '#member-picker input[value="' + CSS.escape(name) + '"]');
                if (box2) box2.checked = false;
            });
            box.appendChild(tag);
        });
    }

    let searchTimer = null;
    document.getElementById('member-search').addEventListener('input', function (e) {
        const q = e.target.value.trim();
        clearTimeout(searchTimer);
        const picker = document.getElementById('member-picker');
        if (q.length < 2) {
            picker.innerHTML = '<p class="text-muted small mb-0">' +
                'พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา</p>';
            return;
        }
        // หน่วงไว้ก่อนยิง ไม่งั้นพิมพ์ชื่อยาว ๆ จะยิงทุกตัวอักษร
        searchTimer = setTimeout(async function () {
            picker.innerHTML = '<p class="text-muted small mb-0">กำลังค้นหา...</p>';
            try {
                const rows = await callApi('GET', '/members?q=' + encodeURIComponent(q));
                if (!rows.length) {
                    picker.innerHTML = '<p class="text-muted small mb-0">ไม่พบสมาชิก</p>';
                    return;
                }
                picker.innerHTML = '';
                rows.forEach(function (row) {
                    const label = document.createElement('label');
                    const input = document.createElement('input');
                    input.type = 'checkbox';
                    input.className = 'form-check-input me-1';
                    input.value = row.fullname;
                    input.checked = chosen.has(row.fullname);
                    input.addEventListener('change', function () {
                        if (input.checked) chosen.add(row.fullname);
                        else chosen.delete(row.fullname);
                        renderChosen();
                    });
                    label.appendChild(input);
                    label.appendChild(document.createTextNode(
                        row.fullname + (row.customer_group ? ' · ' + row.customer_group : '')));
                    picker.appendChild(label);
                });
            } catch (err) {
                picker.innerHTML = '<p class="text-danger small mb-0">' + err.message + '</p>';
            }
        }, 300);
    });

    function openJob(job) {
        document.getElementById('job-error').textContent = '';
        document.getElementById('job-id').value = job ? job.id : '';
        document.getElementById('job-name').value = job ? job.job_name : '';
        document.getElementById('job-note').value = job && job.note ? job.note : '';
        document.getElementById('member-search').value = '';
        document.getElementById('member-picker').innerHTML =
            '<p class="text-muted small mb-0">พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา</p>';
        document.getElementById('job-modal-title').textContent =
            job ? 'แก้ไขงานประจำ' : 'เพิ่มงานประจำ';
        chosen = new Set(job ? (job.members || []) : []);
        renderChosen();
        jobModal.show();
    }

    document.getElementById('new-job').addEventListener('click', function () { openJob(null); });

    document.getElementById('job-table').addEventListener('click', async function (e) {
        const row = e.target.closest('tr[data-job]');
        if (!row) return;
        const job = JSON.parse(row.dataset.job);

        if (e.target.matches('[data-edit-job]')) { openJob(job); return; }

        if (e.target.matches('[data-delete-job]')) {
            // บอกให้ชัดว่าอะไรจะหายและอะไรจะอยู่ ก่อนตัดสินใจ
            const ok = await wbConfirm({
                title: 'ลบงานประจำ',
                message: 'ลบ "' + job.job_name + '" ออกจากรายการงานประจำ?',
                detail: [
                    'รายชื่อสมาชิกในระบบไม่ถูกลบ',
                    'นัดที่ผ่านมาแล้วยังอยู่ครบพร้อมชื่องานเดิม',
                    'ชื่อนี้นำกลับมาตั้งใหม่ได้',
                ],
                confirmText: 'ลบงานประจำ',
            });
            if (!ok) return;
            try {
                const res = await callApi('DELETE', '/jobs/' + job.id);
                window.notify('ลบแล้ว — เก็บนัดเดิมไว้ ' + res.keptSchedules + ' นัด');
                setTimeout(function () { location.reload(); }, 800);
            } catch (err) { window.notify(err.message); }
        }
    });

    document.getElementById('save-job').addEventListener('click', async function () {
        const error = document.getElementById('job-error');
        const id = document.getElementById('job-id').value;
        const payload = {
            job_name: document.getElementById('job-name').value,
            note: document.getElementById('job-note').value,
            members: [...chosen],
        };
        error.textContent = '';
        try {
            if (id) await callApi('PUT', '/jobs/' + id, payload);
            else await callApi('POST', '/jobs', payload);
            jobModal.hide();
            location.reload();
        } catch (err) { error.textContent = err.message; }
    });

    // ── นัด ────────────────────────────────────────────────
    function openSlot(slot, date) {
        const error = document.getElementById('slot-error');
        error.textContent = '';
        document.getElementById('slot-id').value = slot ? slot.id : '';
        document.getElementById('slot-date').value = slot
            ? String(slot.scheduled_date).slice(0, 10) : date;
        document.getElementById('slot-driver').value = slot && slot.driver ? slot.driver : '';
        // สถานะอ่านอย่างเดียว มาจากบิลจริง/ใบจอง
        const statusEl = document.getElementById('slot-status-view');
        statusEl.textContent = slot ? slot.status : 'ยังไม่สร้าง';
        statusEl.className = 'slot-status ' + (
            !slot ? '' :
            slot.status === 'สำเร็จ' ? 'text-success' :
            slot.status === 'ยกเลิก' ? 'text-danger' :
            slot.status === 'ไม่มีข้อมูล' ? 'text-muted' : 'text-warning');

        // ผลรายสมาชิก — งานเดียวกันรวมเป็นก้อน แต่ยังดูแยกเจ้าได้
        const memberWrap = document.getElementById('slot-members-wrap');
        const memberBody = document.querySelector('#slot-members tbody');
        const breakdown = (slot && slot.member_breakdown) || [];
        memberBody.innerHTML = '';
        breakdown.forEach(function (m) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td>' + m.member_name + '</td>' +
                '<td class="num">' + Number(m.bills).toLocaleString() + '</td>' +
                '<td class="num">' + Math.round(m.total_kg).toLocaleString() + '</td>' +
                '<td class="num">' + Math.round(m.total_baht).toLocaleString() + '</td>';
            memberBody.appendChild(tr);
        });
        memberWrap.hidden = !breakdown.length;
        document.getElementById('slot-note').value = slot && slot.note ? slot.note : '';
        document.getElementById('delete-slot').hidden = !slot;

        // งานประจำเลือกได้ตอนสร้างเท่านั้น — แก้ทีหลังจะทำให้ snapshot ไม่ตรงประวัติ
        document.getElementById('slot-job-wrap').hidden = !!slot;

        const shownDate = slot ? String(slot.scheduled_date).slice(0, 10) : date;
        document.getElementById('slot-title').textContent =
            slot ? slot.job_name_snapshot : 'เพิ่มนัด';
        document.getElementById('slot-sub').textContent = shownDate +
            (holidayByDate.get(shownDate) ? ' · ' + holidayByDate.get(shownDate) : '');

        // ประวัติของงานเดียวกันครั้งก่อน ๆ
        const box = document.getElementById('slot-history');
        if (slot) {
            const past = (data.history || [])
                .filter(function (h) {
                    return h.job_name_snapshot === slot.job_name_snapshot &&
                           h.scheduled_date < shownDate;
                })
                .slice(0, 5);
            box.innerHTML = past.length
                ? '<hr><b>ครั้งก่อนหน้า</b><br>' + past.map(function (h) {
                    return h.scheduled_date + ' · ' + (h.assigned_driver || 'ไม่ระบุคนขับ') +
                        ' · ' + Math.round(h.total_baht || 0).toLocaleString() + ' บาท';
                }).join('<br>')
                : '<hr>ยังไม่มีประวัติของงานนี้';
        } else {
            box.innerHTML = '';
        }

        slotModal.show();
    }

    calEl.addEventListener('click', function (e) {
        const addBtn = e.target.closest('[data-add]');
        if (addBtn) {
            const date = addBtn.dataset.add;
            const weekday = new Date(date + 'T00:00:00').getDay();
            const holiday = holidayByDate.get(date);
            if (weekday === 0 || weekday === 6 || holiday) {
                const reason = holiday || (weekday === 0 ? 'วันอาทิตย์' : 'วันเสาร์');
                wbConfirm({
                    title: 'วันนี้เป็นวันหยุด',
                    message: date + ' เป็น' + reason + ' — ยืนยันจะวางนัดในวันนี้?',
                    detail: ['ปกติงานประจำจะเลี่ยงวันหยุดให้อัตโนมัติ'],
                    confirmText: 'วางนัดในวันหยุด',
                }).then(function (ok) { if (ok) openSlot(null, date); });
                return;
            }
            openSlot(null, date);
            return;
        }

        const pin = e.target.closest('[data-slot]');
        if (pin) {
            const slot = (data.schedule || []).find(function (s) {
                return String(s.id) === pin.dataset.slot;
            });
            if (slot) openSlot(slot, null);
        }
    });

    document.getElementById('save-slot').addEventListener('click', async function () {
        const error = document.getElementById('slot-error');
        const id = document.getElementById('slot-id').value;
        error.textContent = '';
        try {
            if (id) {
                await callApi('PUT', '/schedule/' + id, {
                    driver: document.getElementById('slot-driver').value,
                    note: document.getElementById('slot-note').value,
                });
            } else {
                await callApi('POST', '/schedule', {
                    job_id: document.getElementById('slot-job').value,
                    scheduled_date: document.getElementById('slot-date').value,
                    driver: document.getElementById('slot-driver').value,
                    note: document.getElementById('slot-note').value,
                });
            }
            slotModal.hide();
            location.reload();
        } catch (err) { error.textContent = err.message; }
    });

    document.getElementById('delete-slot').addEventListener('click', async function () {
        const id = document.getElementById('slot-id').value;
        if (!id) return;
        const ok = await wbConfirm({
            title: 'ลบนัด',
            message: 'ลบนัดวันที่ ' + document.getElementById('slot-date').value + ' ?',
            detail: ['ยอดขายของวันนั้นมาจากธุรกรรมจริง ไม่ได้ถูกลบไปด้วย'],
            confirmText: 'ลบนัด',
        });
        if (!ok) return;
        try {
            await callApi('DELETE', '/schedule/' + id);
            slotModal.hide();
            location.reload();
        } catch (err) {
            document.getElementById('slot-error').textContent = err.message;
        }
    });

    // ── รับนัดที่แนะนำ ──────────────────────────────────────
    const acceptBtn = document.getElementById('accept-suggestions');
    if (acceptBtn) {
        acceptBtn.addEventListener('click', async function () {
            const items = data.suggestions || [];
            const shifted = items.filter(function (x) { return x.shifted; });
            const ok = await wbConfirm({
                title: 'รับนัดที่แนะนำ',
                message: 'สร้างนัด ' + items.length + ' รายการจากแบบแผนเดือนก่อน?',
                detail: [].concat(
                    shifted.length
                        ? [shifted.length + ' นัดถูกเลื่อนออกจากวันหยุดให้แล้ว']
                        : [],
                    ['แก้คนขับหรือลบทีละนัดได้ภายหลัง']),
                confirmText: 'สร้างนัด',
                danger: false,
            });
            if (!ok) return;

            acceptBtn.disabled = true;
            try {
                const res = await callApi('POST', '/suggest', { items: items });
                window.notify('สร้าง ' + res.created + ' นัด' +
                    (res.skipped ? ' · ข้าม ' + res.skipped : ''));
                setTimeout(function () { location.reload(); }, 800);
            } catch (err) {
                acceptBtn.disabled = false;
                window.notify(err.message);
            }
        });
    }

    // ── ประวัติรายเจ้า ─────────────────────────────────────
    const historyTable = document.getElementById('history-table');
    if (historyTable) {
        historyTable.addEventListener('click', function (e) {
            const row = e.target.closest('.history-row');
            if (!row) return;
            const detail = row.nextElementSibling;
            if (detail && detail.classList.contains('history-detail')) {
                detail.hidden = !detail.hidden;
            }
        });
    }

    // ── วันหยุด ────────────────────────────────────────────
    const syncBtn = document.getElementById('sync-holiday');
    if (syncBtn) {
        syncBtn.addEventListener('click', async function () {
            const year = Number(data.month.slice(0, 4));
            const ok = await wbConfirm({
                title: 'ดึงวันหยุดปี ' + year,
                message: 'ดึงวันหยุดไทยจากปฏิทินสาธารณะของ Google?',
                detail: [
                    'วันหยุดที่กรอกเองไว้จะไม่ถูกทับ',
                    'ดึงมาเก็บในฐาน ใช้งานต่อได้แม้ไม่มีเน็ต',
                ],
                confirmText: 'ดึงวันหยุด',
                danger: false,
            });
            if (!ok) return;

            syncBtn.disabled = true;
            try {
                const res = await callApi('POST', '/holidaysync', { year: year });
                window.notify('ดึงมา ' + res.found + ' วัน · บันทึก ' + res.added +
                    (res.keptManual ? ' · คงของที่กรอกเอง ' + res.keptManual : ''));
                setTimeout(function () { location.reload(); }, 900);
            } catch (err) {
                syncBtn.disabled = false;
                window.notify(err.message);
            }
        });
    }

    const holidayModal = new bootstrap.Modal(document.getElementById('holiday-modal'));

    document.getElementById('add-holiday').addEventListener('click', function () {
        document.getElementById('holiday-date').value = data.month + '-01';
        document.getElementById('holiday-name').value = '';
        document.getElementById('holiday-error').textContent = '';
        holidayModal.show();
    });

    document.getElementById('save-holiday').addEventListener('click', async function () {
        const error = document.getElementById('holiday-error');
        const date = document.getElementById('holiday-date').value;
        const name = document.getElementById('holiday-name').value.trim();
        if (!date || !name) {
            error.textContent = 'ต้องกรอกทั้งวันที่และชื่อวันหยุด';
            return;
        }
        try {
            await callApi('POST', '/holidays', { holiday_date: date, holiday_name: name });
            holidayModal.hide();
            location.reload();
        } catch (err) { error.textContent = err.message; }
    });
})();
