import crypto from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const nowIso = () => new Date().toISOString();
const money = value => Math.round(Number(value) * 100);
const demoAccountNumber = () => `DEMO-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
const publicCustomer = row => ({
  id: row.id,
  username: row.username,
  name: row.name,
  accountNumber: row.account_number,
  currency: row.currency,
  balance: Number(row.balance_cents) / 100,
  createdAt: row.created_at
});

export function passwordHash(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

export function createMemoryBankStore({ username = 'customer.demo', password = 'Demo2026!', openingBalance = 12840.5 } = {}) {
  const salt = crypto.randomBytes(16).toString('hex');
  const customer = {
    id: crypto.randomUUID(), username, name: 'Demo Customer', account_number: 'TR00 0000 0000 0000 0000 0001',
    currency: 'USD', balance_cents: money(openingBalance), password_salt: salt, password_hash: passwordHash(password, salt), active: true, created_at: nowIso()
  };
  const customers = new Map([[customer.id, customer]]);
  const transactions = [{ id: 1, customerId: customer.id, type: 'opening', amount: openingBalance, description: 'Opening demo balance', actor: 'system', createdAt: nowIso() }];
  const messages = [];
  let transactionId = 1; let messageId = 0;
  return {
    async close() {},
    async authenticate(user, pass) { const row = [...customers.values()].find(item => item.username === user && item.active); return row && passwordHash(pass, row.password_salt) === row.password_hash ? publicCustomer(row) : null; },
    async getCustomer(id) { const row = customers.get(id); return row?.active ? publicCustomer(row) : null; },
    async listCustomers() { return [...customers.values()].filter(item => item.active).map(publicCustomer); },
    async createCustomer({ name, username: newUsername, password: newPassword, currency, openingBalance: initialBalance }) {
      if ([...customers.values()].some(item => item.username === newUsername)) return { error: 'username_exists' };
      const createdAt = nowIso(); const customerSalt = crypto.randomBytes(16).toString('hex'); const balanceCents = money(initialBalance);
      const row = { id: crypto.randomUUID(), username: newUsername, name, account_number: demoAccountNumber(), currency, balance_cents: balanceCents, password_salt: customerSalt, password_hash: passwordHash(newPassword, customerSalt), active: true, created_at: createdAt };
      customers.set(row.id, row);
      if (balanceCents > 0) transactions.push({ id: ++transactionId, customerId: row.id, type: 'opening', amount: balanceCents / 100, description: 'Opening balance', actor: 'operator', createdAt });
      return { customer: publicCustomer(row) };
    },
    async deleteCustomer(id) { const row = customers.get(id); if (!row?.active) return false; row.active = false; return true; },
    async getTransactions(id, limit = 100) { return transactions.filter(item => item.customerId === id).slice(-limit).reverse(); },
    async transact({ customerId, type, amount, description, actor }) {
      const activeCustomer = customers.get(customerId); if (!activeCustomer) return { error: 'not_found' };
      const cents = money(amount); if (!Number.isSafeInteger(cents) || cents <= 0) return { error: 'invalid_amount' };
      const debit = type === 'withdrawal' || type === 'debit';
      if (debit && activeCustomer.balance_cents < cents) return { error: 'insufficient_funds' };
      activeCustomer.balance_cents += debit ? -cents : cents;
      const row = { id: ++transactionId, customerId, type, amount: cents / 100, description, actor, createdAt: nowIso() };
      transactions.push(row); return { customer: publicCustomer(activeCustomer), transaction: row };
    },
    async getMessages(id, after = 0) { return messages.filter(item => item.customerId === id && item.id > after); },
    async addMessage({ customerId, sender, body }) { if (!customers.has(customerId)) return null; const row = { id: ++messageId, customerId, sender, body, createdAt: nowIso() }; messages.push(row); return row; }
  };
}

export async function createBankStore(databaseUrl = process.env.DATABASE_URL) {
  const seed = { username: process.env.BANK_DEMO_USER || 'customer.demo', password: process.env.BANK_DEMO_PASSWORD || 'Demo2026!', openingBalance: Number(process.env.BANK_OPENING_BALANCE || 12840.5) };
  if (!databaseUrl) return createMemoryBankStore(seed);
  const pool = new Pool({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bank_customers (
      id UUID PRIMARY KEY, username VARCHAR(80) UNIQUE NOT NULL, name VARCHAR(120) NOT NULL,
      account_number VARCHAR(40) UNIQUE NOT NULL, currency VARCHAR(3) NOT NULL DEFAULT 'USD',
      balance_cents BIGINT NOT NULL DEFAULT 0, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bank_transactions (
      id BIGSERIAL PRIMARY KEY, customer_id UUID NOT NULL REFERENCES bank_customers(id),
      type VARCHAR(24) NOT NULL, amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
      description VARCHAR(180) NOT NULL, actor VARCHAR(20) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bank_messages (
      id BIGSERIAL PRIMARY KEY, customer_id UUID NOT NULL REFERENCES bank_customers(id),
      sender VARCHAR(20) NOT NULL CHECK (sender IN ('customer','operator')), body VARCHAR(2000) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS bank_transactions_customer_idx ON bank_transactions(customer_id, id DESC);
    CREATE INDEX IF NOT EXISTS bank_messages_customer_idx ON bank_messages(customer_id, id);
  `);
  await pool.query('ALTER TABLE bank_customers ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE');
  const salt = crypto.randomBytes(16).toString('hex');
  const id = crypto.randomUUID();
  const inserted = await pool.query(`INSERT INTO bank_customers (id, username, name, account_number, balance_cents, password_salt, password_hash)
    VALUES ($1,$2,'Demo Customer','TR00 0000 0000 0000 0000 0001',$3,$4,$5) ON CONFLICT (username) DO NOTHING RETURNING id`,
    [id, seed.username, money(seed.openingBalance), salt, passwordHash(seed.password, salt)]);
  if (inserted.rowCount) await pool.query("INSERT INTO bank_transactions (customer_id,type,amount_cents,description,actor) VALUES ($1,'opening',$2,'Opening demo balance','system')", [id, money(seed.openingBalance)]);
  return {
    async close() { await pool.end(); },
    async authenticate(username, password) { const { rows } = await pool.query('SELECT * FROM bank_customers WHERE username=$1 AND active=TRUE', [username]); const row = rows[0]; return row && passwordHash(password, row.password_salt) === row.password_hash ? publicCustomer(row) : null; },
    async getCustomer(id) { const { rows } = await pool.query('SELECT * FROM bank_customers WHERE id=$1 AND active=TRUE', [id]); return rows[0] ? publicCustomer(rows[0]) : null; },
    async listCustomers() { const { rows } = await pool.query('SELECT * FROM bank_customers WHERE active=TRUE ORDER BY created_at'); return rows.map(publicCustomer); },
    async createCustomer({ name, username, password, currency, openingBalance }) {
      const client = await pool.connect(); const id = crypto.randomUUID(); const salt = crypto.randomBytes(16).toString('hex'); const balanceCents = money(openingBalance);
      try { await client.query('BEGIN'); const { rows } = await client.query('INSERT INTO bank_customers (id,username,name,account_number,currency,balance_cents,password_salt,password_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [id,username,name,demoAccountNumber(),currency,balanceCents,salt,passwordHash(password,salt)]); if (balanceCents > 0) await client.query("INSERT INTO bank_transactions (customer_id,type,amount_cents,description,actor) VALUES ($1,'opening',$2,'Opening balance','operator')", [id,balanceCents]); await client.query('COMMIT'); return { customer: publicCustomer(rows[0]) }; }
      catch (error) { await client.query('ROLLBACK'); if (error.code === '23505') return { error: 'username_exists' }; throw error; } finally { client.release(); }
    },
    async deleteCustomer(id) { const result = await pool.query('UPDATE bank_customers SET active=FALSE WHERE id=$1 AND active=TRUE', [id]); return result.rowCount === 1; },
    async getTransactions(customerId, limit = 100) { const { rows } = await pool.query('SELECT id,customer_id AS "customerId",type,amount_cents::float/100 AS amount,description,actor,created_at AS "createdAt" FROM bank_transactions WHERE customer_id=$1 ORDER BY id DESC LIMIT $2', [customerId, limit]); return rows; },
    async transact({ customerId, type, amount, description, actor }) {
      const cents = money(amount); if (!Number.isSafeInteger(cents) || cents <= 0) return { error: 'invalid_amount' };
      const debit = type === 'withdrawal' || type === 'debit'; const client = await pool.connect();
      try { await client.query('BEGIN'); const current = await client.query('SELECT * FROM bank_customers WHERE id=$1 FOR UPDATE', [customerId]); if (!current.rowCount) { await client.query('ROLLBACK'); return { error: 'not_found' }; } if (debit && Number(current.rows[0].balance_cents) < cents) { await client.query('ROLLBACK'); return { error: 'insufficient_funds' }; }
        const updated = await client.query('UPDATE bank_customers SET balance_cents=balance_cents+$2 WHERE id=$1 RETURNING *', [customerId, debit ? -cents : cents]);
        const tx = await client.query('INSERT INTO bank_transactions (customer_id,type,amount_cents,description,actor) VALUES ($1,$2,$3,$4,$5) RETURNING id,customer_id AS "customerId",type,amount_cents::float/100 AS amount,description,actor,created_at AS "createdAt"', [customerId,type,cents,description,actor]);
        await client.query('COMMIT'); return { customer: publicCustomer(updated.rows[0]), transaction: tx.rows[0] };
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
    async getMessages(customerId, after = 0) { const { rows } = await pool.query('SELECT id,customer_id AS "customerId",sender,body,created_at AS "createdAt" FROM bank_messages WHERE customer_id=$1 AND id>$2 ORDER BY id LIMIT 500', [customerId, after]); return rows; },
    async addMessage({ customerId, sender, body }) { const { rows } = await pool.query('INSERT INTO bank_messages (customer_id,sender,body) VALUES ($1,$2,$3) RETURNING id,customer_id AS "customerId",sender,body,created_at AS "createdAt"', [customerId,sender,body]); return rows[0] || null; }
  };
}
