const { Pool } = require('pg');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Please paste your Render EXTERNAL DATABASE URL: ', async (dbUrl) => {
  if (!dbUrl || !dbUrl.trim().startsWith('postgres')) {
    console.error('Invalid connection string. It should start with postgres:// or postgresql://');
    rl.close();
    process.exit(1);
  }

  const cleanUrl = dbUrl.trim();
  console.log('Connecting to database...');

  const pool = new Pool({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false } // Required for Render/Neon connection over SSL
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected successfully! Running updates...');

    // 1. Add missing columns to sale_transactions
    console.log('Updating "sale_transactions" table...');
    await client.query(`
      ALTER TABLE "sale_transactions" 
      ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'processing' NOT NULL,
      ADD COLUMN IF NOT EXISTS "order_type" text,
      ADD COLUMN IF NOT EXISTS "delivery_address" text,
      ADD COLUMN IF NOT EXISTS "comment" text;
    `);
    console.log('✅ "sale_transactions" table updated.');

    // 2. Create product_reviews table if it doesn't exist
    console.log('Creating "product_reviews" table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "product_reviews" (
        "id" text PRIMARY KEY NOT NULL,
        "product_id" text NOT NULL,
        "customer_name" text NOT NULL,
        "rating" integer NOT NULL,
        "text" text NOT NULL,
        "timestamp" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    console.log('✅ "product_reviews" table created.');

    // 3. Add foreign key constraint to product_reviews
    console.log('Adding constraints...');
    try {
      await client.query(`
        ALTER TABLE "product_reviews" 
        ADD CONSTRAINT "product_reviews_product_id_products_id_fk" 
        FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;
      `);
      console.log('✅ Constraints added.');
    } catch (e) {
      if (e.code === '42710') {
        console.log('ℹ️ Constraint already exists, skipping.');
      } else {
        throw e;
      }
    }

    client.release();
    console.log('\n🎉 ALL DATABASE UPDATES COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Update failed:', err.message);
  } finally {
    await pool.end();
    rl.close();
  }
});
