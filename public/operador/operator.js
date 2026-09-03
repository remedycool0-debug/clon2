const $ = (s) => document.querySelector(s);
const state = { customers: [], selected: null, currency: 'USD', view: 'customers', conversations: [] };
const money = (n, currency = state.currency) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
const date = (v) =>
  new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    new Date(v)
  );
const escape = (value) =>
  String(value).replace(
    /[&<>'"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]
  );
async function api(url, options) {
  const response = await fetch(url, options);
  let data = {};
  try {
    data = await response.json();
  } catch {}
  if (response.status === 401) {
    showLogin();
    throw new Error('Your session has expired.');
  }
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}
function fail(text = '') {
  $('#operator-error').textContent = text;
}
function showLogin() {
  $('#operator-view').hidden = true;
  $('#login-view').hidden = false;
}
function showPanel() {
  $('#login-view').hidden = true;
  $('#operator-view').hidden = false;
  setView('customers');
  loadCustomers();
}
function setView(view) {
  state.view = view;
  $('#customers-view').hidden = view !== 'customers';
  $('#messages-view').hidden = view !== 'messages';
  $('#customers-nav').classList.toggle('active', view === 'customers');
  $('#messages-nav').classList.toggle('active', view === 'messages');
  $('#workspace-title').textContent = view === 'customers' ? 'Customers and transactions' : 'Customer messages';
  if (view === 'messages') loadConversations();
}
function renderCustomers() {
  const list = $('#customer-list');
  list.replaceChildren();
  $('#customer-count').textContent = `${state.customers.length} record${state.customers.length === 1 ? '' : 's'}`;
  state.customers.forEach((customer) => {
    const button = document.createElement('button');
    button.className = `customer-item${state.selected === customer.id ? ' active' : ''}`;
    button.innerHTML = `<strong>${escape(customer.name)}</strong><span>${escape(customer.accountNumber)}</span><small>${money(customer.balance, customer.currency)}</small>`;
    button.onclick = () => selectCustomer(customer.id);
    list.append(button);
  });
}
async function loadCustomers() {
  try {
    const data = await api('/api/operator/customers');
    state.customers = data.customers;
    renderCustomers();
    if (!state.selected && state.customers[0]) await selectCustomer(state.customers[0].id);
    else if (state.selected) await selectCustomer(state.selected);
    fail();
  } catch (e) {
    fail(e.message);
  }
}
function txRow(tx) {
  const debit = ['withdrawal', 'debit'].includes(tx.type);
  return `<article class="tx ${escape(tx.type)}"><span class="tx-mark">${debit ? '−' : '+'}</span><div><p>${escape(tx.description)}</p><small>${date(tx.createdAt)} · ${tx.actor === 'operator' ? 'Operator' : tx.actor === 'customer' ? 'Customer' : 'System'}</small></div><strong>${debit ? '−' : '+'}${money(tx.amount)}</strong></article>`;
}
function messageRow(message) {
  return `<p class="message ${escape(message.sender)}">${escape(message.body)}<time>${date(message.createdAt)}</time></p>`;
}
async function selectCustomer(id) {
  state.selected = id;
  renderCustomers();
  try {
    const data = await api(`/api/operator/customers/${id}`);
    state.currency = data.customer.currency;
    const withdrawals = data.transactions.filter((x) => x.type === 'withdrawal');
    $('#detail').innerHTML =
      `<div class="customer-head"><div><h2>${escape(data.customer.name)}</h2><p>${escape(data.customer.username)} · ${escape(data.customer.accountNumber)}</p></div><div class="account-chip"><span>${money(data.customer.balance)}</span><small>Available balance</small></div></div><div class="metrics"><div class="metric"><small>Current balance</small><strong>${money(data.customer.balance)}</strong></div><div class="metric"><small>Transactions</small><strong>${data.transactions.length}</strong></div><div class="metric"><small>Withdrawals</small><strong>${withdrawals.length}</strong></div></div><div class="detail-grid account-detail-grid"><section class="block"><h3>Recent activity</h3><div class="transaction-list">${data.transactions.map(txRow).join('') || '<p>No transactions yet.</p>'}</div></section><aside class="block actions"><h3>Adjust balance</h3><form id="balance-form"><div class="segmented"><label><input type="radio" name="type" value="credit" checked>Credit</label><label><input type="radio" name="type" value="debit">Debit</label></div><input name="amount" type="number" min="0.01" step="0.01" placeholder="Amount in ${escape(data.customer.currency)}" required><textarea name="description" maxlength="180" rows="2" placeholder="Adjustment reason"></textarea><button class="primary" type="submit">Apply transaction</button></form></aside></div>`;
    wireForms();
    fail();
  } catch (e) {
    fail(e.message);
  }
}
async function deleteSelectedCustomer() {
  const customer = state.customers.find((item) => item.id === state.selected);
  if (!customer || !window.confirm(`Delete ${customer.name}? This customer will no longer be able to sign in.`)) return;
  try {
    await api(`/api/operator/customers/${customer.id}`, { method: 'DELETE' });
    state.selected = null;
    state.currency = 'USD';
    $('#detail').innerHTML =
      '<div class="empty-state"><span>OPERATIONS</span><h2>Select a customer</h2><p>Review balances and withdrawals, and communicate from one workspace.</p></div>';
    await loadCustomers();
  } catch (e) {
    fail(e.message);
  }
}
function wireForms() {
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'delete-customer';
  deleteButton.textContent = 'Delete customer';
  deleteButton.onclick = deleteSelectedCustomer;
  $('.account-chip').append(deleteButton);
  $('#balance-form').onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/api/operator/customers/${state.selected}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.get('type'),
          amount: Number(form.get('amount')),
          description: form.get('description')
        })
      });
      await loadCustomers();
    } catch (e) {
      fail(e.message);
    }
  };
}
async function loadConversations() {
  try {
    if (!state.customers.length) {
      const data = await api('/api/operator/customers');
      state.customers = data.customers;
    }
    state.conversations = await Promise.all(
      state.customers.map(async (customer) => {
        const detail = await api(`/api/operator/customers/${customer.id}`);
        return { customer: detail.customer, messages: detail.messages };
      })
    );
    state.conversations.sort((a, b) => {
      const aTime = a.messages.at(-1)?.createdAt || a.customer.createdAt;
      const bTime = b.messages.at(-1)?.createdAt || b.customer.createdAt;
      return new Date(bTime) - new Date(aTime);
    });
    renderConversationList();
    if (state.selected && state.conversations.some((item) => item.customer.id === state.selected)) {
      await openConversation(state.selected);
    }
    fail();
  } catch (e) {
    fail(e.message);
  }
}
function renderConversationList() {
  const list = $('#conversation-list');
  $('#conversation-count').textContent =
    `${state.conversations.length} conversation${state.conversations.length === 1 ? '' : 's'}`;
  list.innerHTML = state.conversations
    .map(({ customer, messages }) => {
      const last = messages.at(-1);
      return `<button class="conversation-item${state.selected === customer.id ? ' active' : ''}" type="button" data-customer-id="${escape(customer.id)}"><span class="conversation-avatar">${escape(
        customer.name
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join('')
          .toUpperCase()
      )}</span><span class="conversation-copy"><strong>${escape(customer.name)}</strong><small>${last ? escape(last.body) : 'No messages yet'}</small></span><time>${last ? date(last.createdAt) : ''}</time></button>`;
    })
    .join('');
  list.querySelectorAll('[data-customer-id]').forEach((button) => {
    button.onclick = () => openConversation(button.dataset.customerId);
  });
}
async function openConversation(id) {
  state.selected = id;
  renderConversationList();
  try {
    const data = await api(`/api/operator/customers/${id}`);
    $('#conversation-detail').innerHTML = `<header class="conversation-head"><div class="conversation-avatar">${escape(
      data.customer.name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase()
    )}</div><div><h2>${escape(data.customer.name)}</h2><p>${escape(data.customer.username)} · ${escape(data.customer.accountNumber)}</p></div></header><div class="message-thread" id="bank-messages">${data.messages.map(messageRow).join('') || '<div class="thread-empty"><strong>No messages yet</strong><span>Start the conversation with this customer.</span></div>'}</div><form class="reply-form" id="reply-form"><textarea name="text" maxlength="2000" rows="2" placeholder="Write a reply…" aria-label="Reply to customer" required></textarea><button type="submit">Send reply <span aria-hidden="true">↗</span></button></form>`;
    const thread = $('#bank-messages');
    thread.scrollTop = thread.scrollHeight;
    $('#reply-form').onsubmit = async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      try {
        await api(`/api/operator/customers/${state.selected}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: form.get('text') })
        });
        await loadConversations();
      } catch (e) {
        fail(e.message);
      }
    };
  } catch (e) {
    fail(e.message);
  }
}
const customerDialog = $('#customer-dialog');
function closeCustomerDialog() {
  customerDialog.close();
  $('#customer-form-error').textContent = '';
}
$('#open-customer-dialog').onclick = () => {
  customerDialog.showModal();
  $('#customer-form [name="name"]').focus();
};
$('#close-customer-dialog').onclick = closeCustomerDialog;
$('#cancel-customer').onclick = closeCustomerDialog;
customerDialog.addEventListener('click', (event) => {
  if (event.target === customerDialog) closeCustomerDialog();
});
$('#customer-form').onsubmit = async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const formError = $('#customer-form-error');
  formError.textContent = '';
  try {
    const data = await api('/api/operator/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        username: form.get('username'),
        password: form.get('password'),
        openingBalance: Number(form.get('openingBalance')),
        currency: form.get('currency')
      })
    });
    event.currentTarget.reset();
    closeCustomerDialog();
    state.selected = data.customer.id;
    await loadCustomers();
  } catch (e) {
    formError.textContent = e.message;
  }
};
$('#login-form').onsubmit = async (event) => {
  event.preventDefault();
  const error = $('.form-error');
  error.textContent = '';
  try {
    await api('/api/operator/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: $('#operator-key').value })
    });
    $('#operator-key').value = '';
    showPanel();
  } catch (e) {
    error.textContent = e.message;
  }
};
$('#logout').onclick = async () => {
  await fetch('/api/operator/logout', { method: 'POST' });
  showLogin();
};
$('#refresh').onclick = loadCustomers;
$('#customers-nav').onclick = () => setView('customers');
$('#messages-nav').onclick = () => setView('messages');
$('#refresh-messages').onclick = loadConversations;
api('/api/operator/customers').then(showPanel).catch(showLogin);
