(() => {
  const categories = ['Classroom', 'Wi-Fi', 'Drinking water', 'Laboratory equipment', 'Washroom', 'Hostel maintenance', 'Other'];
  const statuses = ['Pending', 'In Progress', 'Resolved'];
  const categoryRules = [
    { category: 'Wi-Fi', words: ['wifi', 'wi-fi', 'internet', 'network', 'router', 'connection', 'online'] },
    { category: 'Drinking water', words: ['water', 'drinking', 'filter', 'fountain', 'dispenser', 'tap'] },
    { category: 'Laboratory equipment', words: ['laboratory', 'lab', 'microscope', 'equipment', 'apparatus', 'experiment', 'projector'] },
    { category: 'Washroom', words: ['washroom', 'toilet', 'restroom', 'bathroom', 'flush', 'sink', 'urinal'] },
    { category: 'Hostel maintenance', words: ['hostel', 'dorm', 'room', 'residence', 'bed', 'plumbing', 'leak', 'electricity'] },
    { category: 'Classroom', words: ['classroom', 'lecture', 'class', 'desk', 'chair', 'blackboard', 'fan', 'air conditioning', 'ac '] }
  ];
  const $ = (selector) => document.querySelector(selector);
  const form = $('#complaint-form');
  const nameInput = $('#student-name');
  const departmentInput = $('#department');
  const categoryInput = $('#category');
  const descriptionInput = $('#description');
  let complaints = [];
  let suggestedCategory = '';
  let toastTimer;

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  }

  async function refreshComplaints() {
    complaints = await apiRequest('/api/complaints');
    renderStudent();
    renderAdmin();
    return complaints;
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function priorityFor(text) {
    const content = text.toLowerCase();
    const urgentTerms = ['urgent', 'danger', 'dangerous', 'emergency', 'injury', 'unsafe', 'exposed wire', 'sparking', 'fire', 'flood', 'broken glass', 'no water'];
    const highTerms = ['broken', 'not working', 'leak', 'leaking', 'outage', 'cannot use', 'can\'t use', 'blocked', 'overflow', 'smell', 'contaminated'];
    if (urgentTerms.some((term) => content.includes(term))) return 'High';
    if (highTerms.some((term) => content.includes(term))) return 'High';
    if (content.length > 180) return 'Medium';
    return 'Low';
  }

  function categoryFor(text) {
    const content = ` ${text.toLowerCase()} `;
    let best = { category: 'Other', score: 0 };
    for (const rule of categoryRules) {
      const score = rule.words.reduce((total, word) => total + (content.includes(word) ? 1 : 0), 0);
      if (score > best.score) best = { category: rule.category, score };
    }
    return best.category;
  }

  function getSuggestion(text) {
    const clean = text.trim();
    if (clean.length < 8) return null;
    return { category: categoryFor(clean), priority: priorityFor(clean) };
  }

  function showToast(message, isError = false) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  }

  function statusClass(status) {
    return status.toLowerCase().replace(' ', '-');
  }

  function updateSuggestion() {
    const suggestion = getSuggestion(descriptionInput.value);
    const message = $('#assist-message');
    const pill = $('#priority-pill');
    const useButton = $('#use-suggestion');
    suggestedCategory = suggestion?.category ?? '';
    if (!suggestion) {
      message.textContent = 'Add a few details to get a category and priority suggestion.';
      pill.textContent = 'Awaiting details';
      pill.className = 'priority-pill';
      useButton.disabled = true;
      return;
    }
    message.textContent = `Suggested category: ${suggestion.category}`;
    pill.textContent = `${suggestion.priority} priority`;
    pill.className = `priority-pill ${suggestion.priority.toLowerCase()}`;
    useButton.disabled = suggestion.category === 'Other';
  }

  function renderStudent() {
    const sorted = [...complaints].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    $('#student-count').textContent = complaints.length;
    const list = $('#student-complaints');
    if (!sorted.length) {
      list.innerHTML = '<div class="empty-list">No complaints yet. Your campus updates will appear here.</div>';
      return;
    }
    list.innerHTML = sorted.map((item) => `<article class="complaint-row"><div class="complaint-main"><div class="complaint-id">${escapeHtml(item.id)}</div><div class="complaint-title">${escapeHtml(item.description)}</div><div class="complaint-meta"><span>${escapeHtml(item.category)}</span><span>·</span><span>${formatDate(item.createdAt)}</span></div></div><div class="complaint-aside"><span class="status-badge ${statusClass(item.status)}">${escapeHtml(item.status)}</span><span class="priority-label">${escapeHtml(item.priority)} priority</span></div></article>`).join('');
  }

  function renderAdmin() {
    const categoryFilter = $('#filter-category').value;
    const statusFilter = $('#filter-status').value;
    const sorted = [...complaints].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const filtered = sorted.filter((item) => (!categoryFilter || item.category === categoryFilter) && (!statusFilter || item.status === statusFilter));
    $('#stat-total').textContent = complaints.length;
    $('#stat-pending').textContent = complaints.filter((item) => item.status === 'Pending').length;
    $('#stat-progress').textContent = complaints.filter((item) => item.status === 'In Progress').length;
    $('#stat-resolved').textContent = complaints.filter((item) => item.status === 'Resolved').length;
    $('#admin-count').textContent = filtered.length;
    $('#admin-updated').textContent = `Updated ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date())}`;
    $('#admin-empty').hidden = filtered.length > 0;
    $('#complaint-table-body').innerHTML = filtered.map((item) => `<tr><td><span class="table-complaint-id">${escapeHtml(item.id)}</span><small>${escapeHtml(item.description.length > 74 ? `${item.description.slice(0, 74)}…` : item.description)}</small></td><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.department)}</small></td><td><span class="category-chip">${escapeHtml(item.category)}</span></td><td><span class="priority-text ${item.priority.toLowerCase()}">${escapeHtml(item.priority)}</span></td><td>${formatDate(item.createdAt)}</td><td><label class="visually-hidden" for="status-${escapeHtml(item.id)}">Update status for ${escapeHtml(item.id)}</label><select class="status-select" id="status-${escapeHtml(item.id)}" data-complaint-id="${escapeHtml(item.id)}">${statuses.map((status) => `<option${item.status === status ? ' selected' : ''}>${status}</option>`).join('')}</select></td></tr>`).join('');
  }

  async function switchView(viewName) {
    const isAdmin = viewName === 'admin';
    $('#student-view').hidden = isAdmin;
    $('#admin-view').hidden = !isAdmin;
    $('#student-view').classList.toggle('active', !isAdmin);
    $('#admin-view').classList.toggle('active', isAdmin);
    document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === viewName));
    $('#topbar-current').textContent = isAdmin ? 'Admin dashboard' : 'Student portal';
    if (isAdmin) {
      try {
        await refreshComplaints();
      } catch {
        showToast('Could not load reports. Check that the server is running.', true);
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const description = descriptionInput.value.trim();
    if (description.length < 10) {
      descriptionInput.setCustomValidity('Please add at least 10 characters so the team can understand the issue.');
      descriptionInput.reportValidity();
      descriptionInput.setCustomValidity('');
      return;
    }
    const suggestion = getSuggestion(description);
    let complaint;
    try {
      complaint = await apiRequest('/api/complaints', {
        method: 'POST',
        body: JSON.stringify({
      name: nameInput.value.trim(),
      department: departmentInput.value,
      category: categoryInput.value,
          description
        })
      });
    } catch (error) {
      showToast(error.message || 'Could not submit the complaint.', true);
      return;
    }
    complaints = [complaint, ...complaints.filter((item) => item.id !== complaint.id)];
    renderStudent();
    form.reset();
    $('#char-count').textContent = '0';
    updateSuggestion();
    $('#lookup-id').value = complaint.id;
    lookupComplaint(complaint.id);
    showToast(`Complaint submitted. Your ID is ${complaint.id}`);
  });

  descriptionInput.addEventListener('input', () => {
    $('#char-count').textContent = descriptionInput.value.length;
    updateSuggestion();
  });
  $('#use-suggestion').addEventListener('click', () => {
    if (suggestedCategory && suggestedCategory !== 'Other') {
      categoryInput.value = suggestedCategory;
      showToast(`Category set to ${suggestedCategory}`);
    }
  });

  async function lookupComplaint(rawId) {
    const id = rawId.trim().toUpperCase();
    const result = $('#lookup-result');
    let found = complaints.find((item) => item.id.toUpperCase() === id);
    if (!found && id) {
      try {
        found = await apiRequest(`/api/complaints/${encodeURIComponent(id)}`);
      } catch (error) {
        result.innerHTML = `<div class="lookup-error">${escapeHtml(error.message || 'Could not search complaints.')}</div>`;
        return;
      }
    }
    if (!found) {
      result.innerHTML = '<div class="lookup-error">No complaint found with that ID. Check it and try again.</div>';
      return;
    }
    result.innerHTML = `<div class="result-id">${escapeHtml(found.id)}</div><div class="result-line"><span>${escapeHtml(found.category)} · ${formatDate(found.createdAt)}</span><span class="status-badge ${statusClass(found.status)}">${escapeHtml(found.status)}</span></div>`;
  }

  $('#lookup-form').addEventListener('submit', (event) => {
    event.preventDefault();
    lookupComplaint($('#lookup-id').value);
  });
  $('#filter-category').addEventListener('change', renderAdmin);
  $('#filter-status').addEventListener('change', renderAdmin);
  $('#clear-filters').addEventListener('click', () => {
    $('#filter-category').value = '';
    $('#filter-status').value = '';
    renderAdmin();
    showToast('Filters cleared');
  });
  $('#complaint-table-body').addEventListener('change', async (event) => {
    const select = event.target.closest('.status-select');
    if (!select) return;
    const complaint = complaints.find((item) => item.id === select.dataset.complaintId);
    if (!complaint) return;
    try {
      await apiRequest(`/api/complaints/${encodeURIComponent(complaint.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: select.value })
      });
      await refreshComplaints();
      if ($('#lookup-id').value.trim().toUpperCase() === complaint.id) await lookupComplaint(complaint.id);
    } catch (error) {
      showToast(error.message || 'Could not update complaint status.', true);
      renderAdmin();
      return;
    }
    const updated = complaints.find((item) => item.id === complaint.id);
    showToast(`${complaint.id} moved to ${updated.status}`);
  });
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));

  const today = new Date();
  $('#today-label').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(today);
  $('#student-date').textContent = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(today).toUpperCase();
  updateSuggestion();
  refreshComplaints().catch(() => {
    showToast('Could not connect to the complaint server. Start it with npm start.', true);
  });
})();
