/* script.js — Editable MyCamu-like admin panel
   - LocalStorage used for persistence
   - Sections: Students (attendance), Timetable, Assignments, Announcements
   - Add / Edit / Delete support via modal form
*/

(() => {
  /* ---------- Utilities ---------- */
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const qs = (root, sel) => root.querySelector(sel);

  const uid = () => Date.now() + Math.floor(Math.random() * 999);

  /* ---------- Storage wrapper ---------- */
  const DB = {
    load(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } },
    save(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
  };

  /* ---------- Keys & initial seeding ---------- */
  const KEYS = { STUDENTS:'et_students', TIMETABLE:'et_timetable', ASSIGNMENTS:'et_assignments', ANNOUNCEMENTS:'et_announcements' };
  if (DB.load(KEYS.STUDENTS).length === 0) {
    // seed with example student
    DB.save(KEYS.STUDENTS, [
      { id: uid(), name: 'Aisha Sharma', class: '10A', status: 'Present' },
      { id: uid(), name: 'Rohit Kumar', class: '10A', status: 'Absent' },
      { id: uid(), name: 'Meera Patel', class: '9B', status: 'Present' }
    ]);
  }

  /* ---------- State & caches ---------- */
  let students = DB.load(KEYS.STUDENTS);
  let timetable = DB.load(KEYS.TIMETABLE);
  let assignments = DB.load(KEYS.ASSIGNMENTS);
  let announcements = DB.load(KEYS.ANNOUNCEMENTS);

  /* ---------- Navigation ---------- */
  function showPage(id) {
    $$('.page').forEach(p => p.classList.remove('active'));
    const p = $(`#${id}`);
    if (p) p.classList.add('active');
  }
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showPage(btn.dataset.target);
    });
  });

  /* ---------- Global search ---------- */
  $('#globalSearch').addEventListener('input', e => {
    const v = e.target.value.trim().toLowerCase();
    // filter students table and others
    $$('#studentsTable tbody tr').forEach(tr => {
      tr.style.display = v === '' || tr.innerText.toLowerCase().includes(v) ? '' : 'none';
    });
    $$('#assignmentsTable tbody tr').forEach(tr => {
      tr.style.display = v === '' || tr.innerText.toLowerCase().includes(v) ? '' : 'none';
    });
    $$('#announcementsList li').forEach(li => {
      li.style.display = v === '' || li.innerText.toLowerCase().includes(v) ? '' : 'none';
    });
  });

  /* ---------- Rendering functions ---------- */
  function renderStudents() {
    students = DB.load(KEYS.STUDENTS);
    const tbody = $('#studentsTable tbody');
    tbody.innerHTML = '';
    students.forEach(s => {
      const tr = document.createElement('tr');
      tr.dataset.id = s.id;
      tr.innerHTML = `
        <td>${s.name}</td>
        <td>${s.class}</td>
        <td><button class="btn small ${s.status === 'Present' ? '' : 'outline'} status-toggle">${s.status}</button></td>
        <td>
          <button class="btn small edit-student">Edit</button>
          <button class="btn small outline del-student">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    updateMetrics();
  }

  function renderTimetable() {
    timetable = DB.load(KEYS.TIMETABLE);
    const tbody = $('#timetableTable tbody');
    tbody.innerHTML = '';
    timetable.forEach(row => {
      const tr = document.createElement('tr');
      tr.dataset.id = row.id;
      tr.innerHTML = `<td>${row.day}</td><td>${row.period}</td><td>${row.subject}</td><td>${row.teacher}</td>
        <td><button class="btn small edit-timetable">Edit</button> <button class="btn small outline del-timetable">Delete</button></td>`;
      tbody.appendChild(tr);
    });
  }

  function renderAssignments() {
    assignments = DB.load(KEYS.ASSIGNMENTS);
    const tbody = $('#assignmentsTable tbody');
    tbody.innerHTML = '';
    assignments.forEach(a => {
      const tr = document.createElement('tr');
      tr.dataset.id = a.id;
      tr.innerHTML = `<td>${a.title}</td><td>${a.class}</td><td>${a.due || '-'}</td><td>${a.status || 'Open'}</td>
        <td><button class="btn small edit-assignment">Edit</button> <button class="btn small outline del-assignment">Delete</button></td>`;
      tbody.appendChild(tr);
    });
    $('#metricAssignments').textContent = assignments.filter(x => x.status !== 'Submitted').length;
  }

  function renderAnnouncements() {
    announcements = DB.load(KEYS.ANNOUNCEMENTS);
    const ul = $('#announcementsList');
    const dash = $('#dashAnnouncements');
    ul.innerHTML = ''; dash.innerHTML = '';
    announcements.forEach(a => {
      const li = document.createElement('li');
      li.dataset.id = a.id;
      li.innerHTML = `<strong>${a.title}</strong><div class="muted">${a.date || ''}</div><div>${a.body}</div>
        <div style="margin-top:8px"><button class="btn small edit-ann">Edit</button> <button class="btn small outline del-ann">Delete</button></div>`;
      ul.appendChild(li);

      // dashboard short item
      const di = document.createElement('li');
      di.textContent = a.title;
      dash.appendChild(di);
    });
  }

  function renderDashTimetable() {
    const tbl = $('#dashTimetable');
    tbl.innerHTML = '';
    timetable.slice(0,6).forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.day}</td><td>${r.period} — ${r.subject}</td>`;
      tbl.appendChild(tr);
    });
  }

  function updateMetrics() {
    const total = students.length;
    const present = students.filter(s => s.status === 'Present').length;
    $('#metricStudents').textContent = total;
    $('#metricAttendance').textContent = total === 0 ? '0%' : Math.round((present / total) * 100) + '%';
    $('#metricAssignments').textContent = assignments.length ? assignments.filter(a => a.status !== 'Submitted').length : 0;
  }

  /* ---------- Modal (single reusable) ---------- */
  const modalBackdrop = $('#modalBackdrop');
  const modal = modalBackdrop.querySelector('.modal');
  const modalTitle = $('#modalTitle');
  const modalForm = $('#modalForm');
  const modalSave = $('#modalSave');
  const modalCancel = $('#modalCancel');
  const modalClose = $('#modalClose');

  function openModal(title, fields = [], onSave) {
    modalTitle.textContent = title;
    modalForm.innerHTML = '';
    fields.forEach(f => {
      const wrap = document.createElement('div');
      if (f.type === 'textarea') {
        wrap.innerHTML = `<label>${f.label}</label><textarea name="${f.name}" placeholder="${f.placeholder || ''}" ${f.required ? 'required' : ''}>${f.value || ''}</textarea>`;
      } else {
        wrap.innerHTML = `<label>${f.label}</label><input name="${f.name}" type="${f.type || 'text'}" value="${f.value || ''}" placeholder="${f.placeholder || ''}" ${f.required ? 'required' : ''}>`;
      }
      modalForm.appendChild(wrap);
    });
    modalBackdrop.classList.remove('hidden');

    function saveHandler(e) {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(modalForm).entries());
      onSave(data);
      closeModal();
    }

    modalSave.onclick = saveHandler;
    modalCancel.onclick = closeModal;
    modalClose.onclick = closeModal;
    modalBackdrop.onclick = (ev) => { if (ev.target === modalBackdrop) closeModal(); };
  }

  function closeModal() {
    modalBackdrop.classList.add('hidden');
    modalSave.onclick = null;
    modalCancel.onclick = null;
    modalClose.onclick = null;
    modalBackdrop.onclick = null;
  }

  /* ---------- CRUD Handlers ---------- */

  // Add Student
  $('#openAddStudent').addEventListener('click', () => {
    openModal('Add Student', [
      { name: 'name', label: 'Full name', required: true },
      { name: 'class', label: 'Class (e.g., 10A)', required: true }
    ], data => {
      const newS = { id: uid(), name: data.name.trim(), class: data.class.trim(), status: 'Present' };
      students.push(newS);
      DB.save(KEYS.STUDENTS, students);
      renderStudents();
    });
  });

  // Edit / Delete via delegation on students table
  $('#studentsTable').addEventListener('click', e => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    const id = Number(tr.dataset.id);
    if (e.target.classList.contains('status-toggle')) {
      students = students.map(s => s.id === id ? ({ ...s, status: s.status === 'Present' ? 'Absent' : 'Present' }) : s);
      DB.save(KEYS.STUDENTS, students);
      renderStudents();
    } else if (e.target.classList.contains('edit-student')) {
      const s = students.find(x => x.id === id);
      openModal('Edit Student', [
        { name: 'name', label: 'Full name', value: s.name, required: true },
        { name: 'class', label: 'Class', value: s.class, required: true },
        { name: 'status', label: 'Status', type: 'text', value: s.status }
      ], data => {
        students = students.map(x => x.id === id ? ({ ...x, name: data.name.trim(), class: data.class.trim(), status: data.status.trim() || x.status }) : x);
        DB.save(KEYS.STUDENTS, students);
        renderStudents();
      });
    } else if (e.target.classList.contains('del-student')) {
      if (confirm('Delete student?')) {
        students = students.filter(s => s.id !== id);
        DB.save(KEYS.STUDENTS, students);
        renderStudents();
      }
    }
  });

  // Quick mark all present / absent
  $('#markAllPresent').addEventListener('click', () => {
    students = students.map(s => ({ ...s, status: 'Present' }));
    DB.save(KEYS.STUDENTS, students);
    renderStudents();
  });
  $('#markAllAbsent').addEventListener('click', () => {
    students = students.map(s => ({ ...s, status: 'Absent' }));
    DB.save(KEYS.STUDENTS, students);
    renderStudents();
  });

  // Timetable add/edit/delete
  $('#openTimetableForm').addEventListener('click', () => {
    openModal('Add Timetable Period', [
      { name: 'day', label: 'Day (e.g., Monday)', required: true },
      { name: 'period', label: 'Period (e.g., 1)', required: true },
      { name: 'subject', label: 'Subject', required: true },
      { name: 'teacher', label: 'Teacher', required: true }
    ], data => {
      const rec = { id: uid(), day: data.day, period: data.period, subject: data.subject, teacher: data.teacher };
      timetable.push(rec); DB.save(KEYS.TIMETABLE, timetable);
      renderTimetable(); renderDashTimetable();
    });
  });
  $('#timetableTable').addEventListener('click', e => {
    const tr = e.target.closest('tr'); if (!tr) return;
    const id = Number(tr.dataset.id);
    if (e.target.classList.contains('edit-timetable')) {
      const r = timetable.find(t => t.id === id);
      openModal('Edit Period', [
        { name: 'day', label: 'Day', value: r.day, required: true },
        { name: 'period', label: 'Period', value: r.period, required: true },
        { name: 'subject', label: 'Subject', value: r.subject, required: true },
        { name: 'teacher', label: 'Teacher', value: r.teacher, required: true }
      ], data => {
        timetable = timetable.map(x => x.id === id ? ({ ...x, day: data.day, period: data.period, subject: data.subject, teacher: data.teacher }) : x);
        DB.save(KEYS.TIMETABLE, timetable); renderTimetable(); renderDashTimetable();
      });
    } else if (e.target.classList.contains('del-timetable')) {
      if (confirm('Remove period?')) {
        timetable = timetable.filter(t => t.id !== id); DB.save(KEYS.TIMETABLE, timetable); renderTimetable(); renderDashTimetable();
      }
    }
  });

  // Assignments add/edit/delete
  $('#openAssignmentForm').addEventListener('click', () => {
    openModal('New Assignment', [
      { name: 'title', label: 'Title', required: true },
      { name: 'class', label: 'Class', required: true },
      { name: 'due', label: 'Due date (optional)', placeholder: 'YYYY-MM-DD' },
      { name: 'details', label: 'Details', type: 'textarea' }
    ], data => {
      const rec = { id: uid(), title: data.title, class: data.class, due: data.due, body: data.details, status: 'Open' };
      assignments.push(rec); DB.save(KEYS.ASSIGNMENTS, assignments);
      renderAssignments();
    });
  });

  $('#assignmentsTable').addEventListener('click', e => {
    const tr = e.target.closest('tr'); if (!tr) return;
    const id = Number(tr.dataset.id);
    if (e.target.classList.contains('edit-assignment')) {
      const a = assignments.find(x => x.id === id);
      openModal('Edit Assignment', [
        { name: 'title', label: 'Title', value: a.title, required: true },
        { name: 'class', label: 'Class', value: a.class, required: true },
        { name: 'due', label: 'Due', value: a.due },
        { name: 'status', label: 'Status', value: a.status }
      ], data => {
        assignments = assignments.map(x => x.id === id ? ({ ...x, title: data.title, class: data.class, due: data.due, status: data.status }) : x);
        DB.save(KEYS.ASSIGNMENTS, assignments); renderAssignments();
      });
    } else if (e.target.classList.contains('del-assignment')) {
      if (confirm('Delete assignment?')) {
        assignments = assignments.filter(x => x.id !== id); DB.save(KEYS.ASSIGNMENTS, assignments); renderAssignments();
      }
    }
  });

  // Announcements add/edit/delete
  $('#openAnnouncementForm').addEventListener('click', () => {
    openModal('Post Announcement', [
      { name: 'title', label: 'Title', required: true },
      { name: 'body', label: 'Message', type: 'textarea', required: true }
    ], data => {
      const rec = { id: uid(), title: data.title, body: data.body, date: (new Date()).toLocaleString() };
      announcements.unshift(rec); DB.save(KEYS.ANNOUNCEMENTS, announcements); renderAnnouncements();
    });
  });

  $('#announcementsList').addEventListener('click', e => {
    const li = e.target.closest('li'); if (!li) return;
    const id = Number(li.dataset.id);
    if (e.target.classList.contains('edit-ann')) {
      const a = announcements.find(x => x.id === id);
      openModal('Edit Announcement', [
        { name: 'title', label: 'Title', value: a.title, required: true },
        { name: 'body', label: 'Message', type: 'textarea', value: a.body, required: true }
      ], data => {
        announcements = announcements.map(x => x.id === id ? ({ ...x, title: data.title, body: data.body }) : x);
        DB.save(KEYS.ANNOUNCEMENTS, announcements); renderAnnouncements();
      });
    } else if (e.target.classList.contains('del-ann')) {
      if (confirm('Delete announcement?')) {
        announcements = announcements.filter(x => x.id !== id); DB.save(KEYS.ANNOUNCEMENTS, announcements); renderAnnouncements();
      }
    }
  });

  /* ---------- Misc UI ---------- */
  // collapse sidebar
  $('#collapseBtn').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('collapsed');
  });

  // dark toggle
  $('#darkToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    $('#darkToggle').textContent = document.body.classList.contains('dark') ? 'Light' : 'Dark';
  });

  // small filter for students table
  $('#filterStudents').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    $$('#studentsTable tbody tr').forEach(tr => {
      tr.style.display = !q || tr.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  /* ---------- Initial render ---------- */
  function init() {
    renderStudents();
    renderTimetable();
    renderAssignments();
    renderAnnouncements();
    renderDashTimetable();
    updateMetrics();
    // attach simple delegation for dashboard tables that may be empty
    $('#studentsTable tbody').addEventListener('click', () => {});
  }
  document.addEventListener('DOMContentLoaded', init);

})();
