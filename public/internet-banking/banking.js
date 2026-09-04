const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = { data: null, view: 'home', balanceVisible: true, cardVisible: false };
let activeCurrency = 'USD';

const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: activeCurrency }).format(value);
const date = (value) =>
  new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
const escape = (value) =>
  String(value ?? '').replace(
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
  return `•••• ${String(value || '')
    .replace(/\s/g, '')
    .slice(-4)}`;
}
function maskCard(value) {
  return `•••• •••• •••• ${String(value || '')
    .replace(/\s/g, '')
    .slice(-4)}`;
}
function txRow(transaction) {
  const debit = ['withdrawal', 'debit', 'payment'].includes(transaction.type);
  const label = transaction.type === 'payment' ? 'Payment' : transaction.type === 'withdrawal' ? 'Transfer' : 'Credit';
  return `<article class="tx ${escape(transaction.type)}">
    <span class="tx-icon" aria-hidden="true">${debit ? '-' : '+'}</span>
    <div><p>${escape(transaction.description)}</p><small>${label} · ${date(transaction.createdAt)}</small></div>
    <strong>${debit ? '-' : '+'}${money(transaction.amount)}</strong>
  </article>`;
}
function messageRow(message) {
  return `<p class="message ${escape(message.sender)}">${escape(message.body)}<time>${date(message.createdAt)}</time></p>`;
}
function accountCard(customer) {
  return `<article class="balance-card bento-card">
    <div class="balance-card-head"><span>${escape(customer.currency)} current account</span><strong>VISA</strong></div>
    <div class="balance-main"><small>Available balance</small><div><strong id="balance-value" data-value="${escape(money(customer.balance))}">${escape(money(customer.balance))}</strong><button id="toggle-balance" type="button">Hide</button></div></div>
    <footer><span><small>ACCOUNT / IBAN</small><strong>${escape(maskAccount(customer.accountNumber))}</strong></span><span><small>STATUS</small><strong>Available</strong></span></footer>
  </article>`;
}
function cardVisual(customer, compact = false) {
  const numberAttributes = compact ? '' : 'id="card-number" data-value="' + escape(customer.cardNumber) + '"';
  const cvvAttributes = compact ? '' : 'id="card-cvv" data-value="' + escape(customer.cardCvv) + '"';
  return `<div class="debit-card ${compact ? 'compact-card' : ''} ${customer.cardStatus === 'frozen' ? 'is-frozen' : ''}">
    <div class="debit-card-top"><span>Ziraat</span><strong>VISA</strong></div>
    ${compact ? '' : '<button id="reveal-card" type="button">Show details</button>'}
    <div class="card-number" ${numberAttributes}>${escape(maskCard(customer.cardNumber))}</div>
    <div class="card-secrets"><span><small>VALID THRU</small><strong>${escape(customer.cardExpiry)}</strong></span><span><small>CVV</small><strong ${cvvAttributes}>•••</strong></span></div>
  </div>`;
}
function operationForm(type) {
  const payment = type === 'payment';
  return `<form class="operation-form" data-transaction-form="${type}">
    <div class="form-intro-row"><div><span class="form-index">${payment ? 'PY' : 'TR'}</span><h2>${payment ? 'Pay a service' : 'Make a transfer'}</h2></div><small>Available ${money(state.data.customer.balance)}</small></div>
    <label>${payment ? 'Service or company' : 'Recipient'}<input name="recipient" maxlength="80" placeholder="${payment ? 'Electricity, phone, internet' : 'Name or account number'}" required /></label>
    <label>Amount<input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00 ${escape(activeCurrency)}" required /></label>
    <label>Reference<textarea name="description" maxlength="180" rows="3" placeholder="Add a note (optional)"></textarea></label>
    <button class="primary operation-submit" type="submit">${payment ? 'Confirm payment' : 'Review transfer'}<span>Continue</span></button>
    <p class="form-assurance">Encrypted operation. Your balance updates immediately in this demo.</p>
  </form>`;
}

function renderDashboard(data) {
  const customer = data.customer;
  const recent = data.transactions.slice(0, 4);
  const payments = [
    ['Electricity', 'Utility service'],
    ['Phone', 'Mobile or landline'],
    ['Internet', 'Home connectivity']
  ];
  $('#dashboard').innerHTML = `<div class="views-shell">
    <section class="bank-view home-view" data-page="home">
      <div class="welcome-line"><div><p id="greeting">Good morning,</p><h2>${escape(customer.name)}</h2></div><button type="button" data-deposit>Deposit funds<span>Requires support</span></button></div>
      <div class="home-bento">
        ${accountCard(customer)}
        <article class="action-deck bento-card"><header><span>Quick access</span><small>Choose an operation</small></header><button type="button" data-go="transfer"><span>Transfer money</span><small>To another account</small></button><button type="button" data-go="payments"><span>Pay a bill</span><small>Utilities and services</small></button><button class="locked-row" type="button" data-deposit><span>Deposit</span><small>Contact support</small></button></article>
        <article class="activity-card bento-card"><header><div><span>Recent activity</span><small>${data.transactions.length} total movements</small></div><button type="button" data-go="activity">View all</button></header><div class="tx-list">${recent.map(txRow).join('') || '<p class="empty-copy">Your activity will appear here.</p>'}</div></article>
        <article class="card-preview bento-card"><header><span>Your card</span><i class="card-dot ${escape(customer.cardStatus)}"></i></header>${cardVisual(customer, true)}<button type="button" data-go="card">Manage card<span>Open controls</span></button></article>
      </div>
    </section>

    <section class="bank-view operation-view" data-page="transfer" hidden>
      <div class="editorial-head"><p>Send money securely</p><h2>Transfer without the clutter.</h2><span>Enter the recipient and amount. You will see the movement in your activity immediately.</span></div>
      <div class="operation-layout">${operationForm('withdrawal')}<aside class="context-panel"><span>FROM ACCOUNT</span><strong>${escape(customer.accountNumber)}</strong><div><small>Available balance</small><b>${money(customer.balance)}</b></div><p>Transfers are debited from your primary ${escape(customer.currency)} account.</p></aside></div>
    </section>

    <section class="bank-view operation-view" data-page="payments" hidden>
      <div class="editorial-head"><p>Everyday payments</p><h2>Pay essentials in a few steps.</h2><span>Select a frequent service or enter another company in the payment form.</span></div>
      <div class="payee-strip">${payments.map(([name, detail], index) => `<button type="button" data-payee="${name}"><span>0${index + 1}</span><strong>${name}</strong><small>${detail}</small></button>`).join('')}</div>
      <div class="operation-layout">${operationForm('payment')}<aside class="context-panel payment-context"><span>CARD STATUS</span><strong>${customer.cardStatus === 'frozen' ? 'Card frozen' : 'Ready to pay'}</strong><div><small>Card ending in</small><b>${escape(String(customer.cardNumber).replace(/\s/g, '').slice(-4))}</b></div><p>${customer.cardStatus === 'frozen' ? 'Unfreeze your card before attempting a payment.' : 'Payments use your active debit card and available account balance.'}</p><button type="button" data-go="card">Manage card</button></aside></div>
    </section>

    <section class="bank-view card-view" data-page="card" hidden>
      <div class="editorial-head"><p>Card controls</p><h2>Your card, under your control.</h2><span>Reveal the details only when you need them, or freeze the card instantly.</span></div>
      <div class="card-layout"><div>${cardVisual(customer)}</div><aside class="card-control-panel"><span class="card-status ${escape(customer.cardStatus)}">${customer.cardStatus === 'frozen' ? 'Frozen' : 'Active'}</span><h3>${customer.cardStatus === 'frozen' ? 'Your card is paused.' : 'Your card is ready.'}</h3><p>${customer.cardStatus === 'frozen' ? 'New card payments are blocked. Transfers remain available.' : 'Freeze it immediately if the card is lost or you notice unfamiliar activity.'}</p><dl><div><dt>Account</dt><dd>${escape(maskAccount(customer.accountNumber))}</dd></div><div><dt>Currency</dt><dd>${escape(customer.currency)}</dd></div><div><dt>Card type</dt><dd>Debit</dd></div></dl><button id="toggle-card-status" type="button">${customer.cardStatus === 'frozen' ? 'Unfreeze card' : 'Freeze card'}</button></aside></div>
    </section>

    <section class="bank-view activity-view" data-page="activity" hidden>
      <div class="editorial-head"><p>Account history</p><h2>Every movement, clearly listed.</h2><span>Your transfers, service payments and operator adjustments appear together.</span></div>
      <article class="activity-ledger"><header><div><strong>Transactions</strong><small>Most recent first</small></div><span>${data.transactions.length} movements</span></header><div class="tx-list">${data.transactions.map(txRow).join('') || '<p class="empty-copy">No transactions yet.</p>'}</div></article>
    </section>

    <section class="bank-view support-view" data-page="support" hidden>
      <div class="support-hero"><div><p>Direct customer care</p><h2>Tell us what you need.</h2><span>Your messages go directly to the operations team assigned to your account.</span><button type="button" data-open-chat>Start a conversation</button></div><aside><span>SUPPORT STATUS</span><strong>Available</strong><small>Messages stay connected to your customer profile.</small></aside></div>
      <div class="support-grid"><article><span>Deposits</span><h3>Need to add money?</h3><p>Deposits are protected and require manual support activation.</p><button type="button" data-deposit>Request help</button></article><article><span>Card security</span><h3>Lost or unfamiliar card use?</h3><p>Freeze the card now and contact the operations team.</p><button type="button" data-go="card">Open card controls</button></article></div>
    </section>
  </div>`;
}

const viewMeta = {
  home: ['Your financial home', 'Overview'],
  transfer: ['Move money', 'Transfers'],
  payments: ['Manage essentials', 'Payments'],
  card: ['Security and access', 'Cards'],
  activity: ['Your account history', 'Activity'],
  support: ['Direct assistance', 'Support']
};

function setView(view, animate = true) {
  if (!viewMeta[view]) return;
  state.view = view;
  $$('.bank-view').forEach((page) => (page.hidden = page.dataset.page !== view));
  $$('[data-view]').forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    if (button.closest('.side-nav'))
      active ? button.setAttribute('aria-current', 'page') : button.removeAttribute('aria-current');
  });
  $('#view-kicker').textContent = viewMeta[view][0];
  $('#view-title').textContent = viewMeta[view][1];
  window.scrollTo({ top: 0, behavior: animate ? 'smooth' : 'auto' });
  const page = $(`[data-page="${view}"]`);
  if (animate && window.gsap) {
    window.gsap.killTweensOf(page.children);
    window.gsap.fromTo(
      page.children,
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.62, stagger: 0.08, ease: 'power3.out' }
    );
  }
}

function setChat(open) {
  const panel = $('#message-panel');
  panel.hidden = !open;
  $('#chat-launcher').setAttribute('aria-expanded', String(open));
  if (open) {
    panel.querySelector('textarea').focus();
    $('#support-messages').scrollTop = $('#support-messages').scrollHeight;
    if (window.gsap)
      window.gsap.fromTo(
        panel,
        { y: 20, opacity: 0, scale: 0.97 },
        { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: 'power3.out' }
      );
  }
}

function openDepositDialog() {
  const dialog = $('#deposit-dialog');
  if (!dialog.open) dialog.showModal();
  if (window.gsap)
    window.gsap.fromTo(dialog, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' });
}

async function submitTransaction(event) {
  event.preventDefault();
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  try {
    await api('/api/banking/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: formElement.dataset.transactionForm,
        amount: Number(form.get('amount')),
        description: `${form.get('recipient')}${form.get('description') ? ` · ${form.get('description')}` : ''}`
      })
    });
    formElement.reset();
    await load();
    setView('activity');
  } catch (error) {
    fail(error.message);
  }
}

function wireDashboard() {
  $$('[data-go]').forEach((button) => (button.onclick = () => setView(button.dataset.go)));
  $$('[data-deposit]').forEach((button) => (button.onclick = openDepositDialog));
  $$('[data-open-chat]').forEach((button) => (button.onclick = () => setChat(true)));
  $$('[data-transaction-form]').forEach((form) => (form.onsubmit = submitTransaction));
  $$('[data-payee]').forEach((button) => {
    button.onclick = () => {
      const input = $('[data-page="payments"] [name="recipient"]');
      input.value = button.dataset.payee;
      input.focus();
      button.parentElement
        .querySelectorAll('button')
        .forEach((item) => item.classList.toggle('selected', item === button));
    };
  });
  $('#toggle-balance').onclick = () => {
    state.balanceVisible = !state.balanceVisible;
    const value = $('#balance-value');
    value.textContent = state.balanceVisible ? value.dataset.value : '••••••';
    $('#toggle-balance').textContent = state.balanceVisible ? 'Hide' : 'Show';
  };
  $('#reveal-card').onclick = () => {
    state.cardVisible = !state.cardVisible;
    $('#card-number').textContent = state.cardVisible
      ? $('#card-number').dataset.value
      : maskCard($('#card-number').dataset.value);
    $('#card-cvv').textContent = state.cardVisible ? $('#card-cvv').dataset.value : '•••';
    $('#reveal-card').textContent = state.cardVisible ? 'Hide details' : 'Show details';
  };
  $('#toggle-card-status').onclick = async () => {
    try {
      await api('/api/banking/card-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: state.data.customer.cardStatus === 'frozen' ? 'active' : 'frozen' })
      });
      await load();
      setView('card');
    } catch (error) {
      fail(error.message);
    }
  };
}

function render(data) {
  state.data = data;
  activeCurrency = data.customer.currency;
  $('#login').hidden = true;
  $('#app').hidden = false;
  const customerInitials = initials(data.customer.name);
  $('#avatar').textContent = customerInitials;
  $('#sidebar-avatar').textContent = customerInitials;
  $('#sidebar-name').textContent = data.customer.name;
  const hour = new Date().getHours();
  renderDashboard(data);
  $('#greeting').textContent = hour < 12 ? 'Good morning,' : hour < 19 ? 'Good afternoon,' : 'Good evening,';
  $('#support-messages').innerHTML =
    data.messages.map(messageRow).join('') || '<p class="message">Hello. How can we help?</p>';
  wireDashboard();
  setView(state.view, false);
  fail();
  if (window.gsap)
    window.gsap.from('.home-bento > *', { y: 28, opacity: 0, duration: 0.7, stagger: 0.07, ease: 'power3.out' });
}

function fail(text = '') {
  $('#app-error').textContent = text;
}
function showLogin() {
  $('#app').hidden = true;
  $('#login').hidden = false;
}
async function load() {
  try {
    render(await api('/api/banking/me'));
  } catch (error) {
    if (!$('#app').hidden) fail(error.message);
  }
}
async function logout() {
  await fetch('/api/banking/logout', { method: 'POST' });
  showLogin();
}

$('#login-form').onsubmit = async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const errorElement = $('#login-form .error');
  errorElement.textContent = '';
  try {
    await api('/api/banking/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.get('username'), password: form.get('password') })
    });
    await load();
  } catch (error) {
    errorElement.textContent = error.message;
  }
};
$('#logout').onclick = logout;
$$('[data-view]').forEach((button) => (button.onclick = () => setView(button.dataset.view)));
$('#chat-launcher').onclick = () => setChat($('#message-panel').hidden);
$('#chat-close').onclick = () => setChat(false);
$('#close-deposit-dialog').onclick = () => $('#deposit-dialog').close();
$('#contact-deposit-support').onclick = () => {
  $('#deposit-dialog').close();
  setView('support');
  setChat(true);
  const field = $('#message-form textarea');
  field.value = 'Hello, I need help enabling deposits on my account.';
  field.focus();
};
$('#message-form').onsubmit = async (event) => {
  event.preventDefault();
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  try {
    await api('/api/banking/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: form.get('text') })
    });
    formElement.reset();
    await load();
    setChat(true);
  } catch (error) {
    fail(error.message);
  }
};
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('#message-panel').hidden) setChat(false);
});

load();
