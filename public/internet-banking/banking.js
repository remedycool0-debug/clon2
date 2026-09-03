const $ = (s) => document.querySelector(s);
let activeCurrency = 'USD',
  balanceVisible = true;
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
  return `<article class="tx ${escape(tx.type)}"><span class="tx-icon" aria-hidden="true">${debit ? '↙' : '↗'}</span><div><p>${escape(tx.description)}</p><small>${date(tx.createdAt)}</small></div><strong>${debit ? '−' : '+'}${money(tx.amount)}</strong></article>`;
}
function msgRow(msg) {
  return `<p class="message ${escape(msg.sender)}">${escape(msg.body)}<time>${date(msg.createdAt)}</time></p>`;
}
function initials(name) {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'PC'
  );
}
function maskAccount(value) {
  const clean = String(value);
  return `•••• ${clean.replace(/\s/g, '').slice(-4)}`;
}
function render(data) {
  const c = data.customer;
  activeCurrency = c.currency;
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#customer-name').textContent = c.name;
  $('#avatar').textContent = initials(c.name);
  $('#greeting').textContent =
    new Date().getHours() < 12 ? 'Good morning,' : new Date().getHours() < 19 ? 'Good afternoon,' : 'Good evening,';
  $('#dashboard').innerHTML =
    `<div class="dashboard" id="top"><p class="section-kicker">Personal overview</p><h2 class="section-title">Your account</h2><div class="account-layout"><section class="account-card"><div class="card-top"><span class="currency-badge"><i class="flag">${escape(c.currency.slice(0, 2))}</i>${escape(c.currency)} account</span><span class="visa">VISA</span></div><div><p class="balance-label">Available balance</p><div class="balance-line"><strong id="balance-value" data-value="${escape(money(c.balance))}">${escape(money(c.balance))}</strong><button class="eye" id="toggle-balance" type="button" aria-label="Hide balance">◉</button></div></div><div class="card-bottom"><div><span>Account number</span><strong>${escape(maskAccount(c.accountNumber))}</strong></div><div><span>Account type</span><strong>Primary · ${escape(c.currency)}</strong></div></div></section><div class="quick-actions"><button class="quick-action" type="button" data-action="deposit"><span class="action-icon">↙</span><strong>Request</strong></button><button class="quick-action" type="button" data-action="withdrawal"><span class="action-icon">↗</span><strong>Transfer</strong></button><button class="quick-action primary-action" type="button" data-action="deposit"><span class="action-icon">＋</span><strong>Add money</strong></button></div></div><div class="lower-grid"><section class="panel transactions-panel" id="activity"><div class="panel-head"><h2>Transactions</h2><small>Latest ${data.transactions.length}</small></div><div class="tx-list">${data.transactions.map(txRow).join('') || '<p>No transactions yet.</p>'}</div></section><div class="side-stack"><section class="panel" id="operate"><div class="panel-head"><h2>Move money</h2><small>Instantly</small></div><form class="move-form" id="move-form"><div class="toggle"><label><input type="radio" name="type" value="deposit" checked>Request</label><label><input type="radio" name="type" value="withdrawal">Transfer</label></div><input name="amount" type="number" min="0.01" step="0.01" placeholder="Amount in ${escape(c.currency)}" required><textarea name="description" maxlength="180" rows="2" placeholder="Add a note (optional)"></textarea><button class="primary">Confirm transaction</button></form></section><section class="panel" id="message-panel"><div class="panel-head"><h2>Support</h2><small>Direct messages</small></div><div class="messages">${data.messages.map(msgRow).join('') || '<p class="message">Hello! How can we help?</p>'}</div><form class="message-form" id="message-form"><textarea name="text" maxlength="2000" rows="2" placeholder="Write your message" aria-label="Support message" required></textarea><button aria-label="Send message">↗</button></form></section></div></div></div>`;
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
function scrollToPanel(id) {
  $(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function wire() {
  $('#toggle-balance').onclick = () => {
    balanceVisible = !balanceVisible;
    const value = $('#balance-value'),
      button = $('#toggle-balance');
    value.textContent = balanceVisible ? value.dataset.value : '••••••';
    button.textContent = balanceVisible ? '◉' : '○';
    button.setAttribute('aria-label', balanceVisible ? 'Hide balance' : 'Show balance');
  };
  document.querySelectorAll('[data-action]').forEach(
    (button) =>
      (button.onclick = () => {
        scrollToPanel('#operate');
        const input = $(`#move-form input[value="${button.dataset.action}"]`);
        if (input) {
          input.checked = true;
          $('#move-form input[name="amount"]').focus();
        }
      })
  );
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
  const form = new FormData(event.currentTarget),
    error = $('#login-form .error');
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
async function logout() {
  await fetch('/api/banking/logout', { method: 'POST' });
  showLogin();
}
$('#logout').onclick = logout;
$('#mobile-logout').onclick = logout;
$('#focus-move').onclick = () => scrollToPanel('#operate');
$('#focus-activity').onclick = () => scrollToPanel('#activity');
$('#focus-message').onclick = () => scrollToPanel('#message-panel');
document.querySelectorAll('[data-mobile-target]').forEach(
  (button) =>
    (button.onclick = () => {
      document.querySelectorAll('.mobile-nav button').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      const targets = { top: '#top', activity: '#activity', transfer: '#operate', support: '#message-panel' };
      scrollToPanel(targets[button.dataset.mobileTarget]);
    })
);
load();
