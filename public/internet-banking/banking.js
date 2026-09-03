const $ = (s) => document.querySelector(s);
let activeCurrency = 'USD';
const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: activeCurrency }).format(n);
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
function showLogin() {
  $('#app').hidden = true;
  $('#login').hidden = false;
}
function fail(text = '') {
  $('#app-error').textContent = text;
}
function txRow(tx) {
  const debit = ['withdrawal', 'debit'].includes(tx.type);
  return `<article class="tx ${escape(tx.type)}"><span class="tx-icon">${debit ? '−' : '+'}</span><div><p>${escape(tx.description)}</p><small>${date(tx.createdAt)}</small></div><strong>${debit ? '−' : '+'}${money(tx.amount)}</strong></article>`;
}
function msgRow(msg) {
  return `<p class="message ${escape(msg.sender)}">${escape(msg.body)}<time>${date(msg.createdAt)}</time></p>`;
}
function render(data) {
  const c = data.customer;
  activeCurrency = c.currency;
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#customer-name').textContent = c.name;
  $('#greeting').textContent =
    new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 19 ? 'Good afternoon' : 'Good evening';
  $('#dashboard').innerHTML =
    `<section class="balance-card"><p>Available balance</p><strong>${money(c.balance)}</strong><footer><span>${escape(c.accountNumber)}</span><span>${escape(c.currency)} · Primary account</span></footer></section><div class="dashboard-grid"><section class="panel"><div class="panel-head"><h2>Transactions</h2><small>Latest ${data.transactions.length}</small></div><div class="tx-list">${data.transactions.map(txRow).join('') || '<p>No transactions yet.</p>'}</div></section><div><section class="panel" id="operate"><h2>Deposit or withdraw</h2><form class="move-form" id="move-form"><div class="toggle"><label><input type="radio" name="type" value="deposit" checked>Deposit</label><label><input type="radio" name="type" value="withdrawal">Withdraw</label></div><input name="amount" type="number" min="0.01" step="0.01" placeholder="Amount in ${escape(c.currency)}" required><textarea name="description" maxlength="180" rows="2" placeholder="Optional description"></textarea><button class="primary">Confirm transaction</button></form></section><section class="panel" id="message-panel"><div class="panel-head"><h2>Messages</h2><small>Direct support</small></div><div class="messages">${data.messages.map(msgRow).join('') || '<p class="message">Write to our support team.</p>'}</div><form class="message-form" id="message-form"><textarea name="text" maxlength="2000" rows="2" placeholder="Write your message" required></textarea><button>Send</button></form></section></div></div>`;
  wire();
  fail();
}
async function load() {
  try {
    render(await api('/api/banking/me'));
  } catch (e) {
    if (!$('#app').hidden) fail(e.message);
  }
}
function wire() {
  $('#move-form').onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/api/banking/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.get('type'),
          amount: Number(form.get('amount')),
          description: form.get('description')
        })
      });
      await load();
    } catch (e) {
      fail(e.message);
    }
  };
  $('#message-form').onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/api/banking/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: form.get('text') })
      });
      await load();
    } catch (e) {
      fail(e.message);
    }
  };
}
$('#login-form').onsubmit = async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const error = $('#login-form .error');
  error.textContent = '';
  try {
    const data = await api('/api/banking/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.get('username'), password: form.get('password') })
    });
    render({ ...data, transactions: [], messages: [] });
    await load();
  } catch (e) {
    error.textContent = e.message;
  }
};
$('#logout').onclick = async () => {
  await fetch('/api/banking/logout', { method: 'POST' });
  showLogin();
};
$('#focus-move').onclick = () => $('#operate')?.scrollIntoView({ behavior: 'smooth' });
$('#focus-message').onclick = () => $('#message-panel')?.scrollIntoView({ behavior: 'smooth' });
load();
