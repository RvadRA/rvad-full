import pg from 'pg';

const connectionString = 'postgresql://postgres:postgres@localhost:5432/rvad_retailos';
const client = new pg.Client({ connectionString });

async function query() {
  try {
    await client.connect();
    const res = await client.query('SELECT id, name, role, status, telegram_chat_id FROM employees');
    console.log('Employees with status:', res.rows);
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

query();
