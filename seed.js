import { db } from './index.js';
import { admins } from './schema.js';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

async function seed() {
  try {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;

    if (!username || !password) {
      console.error('ERROR: ADMIN_USERNAME and ADMIN_PASSWORD must be set in environment variables');
      process.exit(1);
    }

    const existingAdmin = await db.select().from(admins).where(eq(admins.username, username));

    if (existingAdmin.length > 0) {
      console.log('Admin user already exists. Updating password...');
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.update(admins)
        .set({ password: hashedPassword })
        .where(eq(admins.username, username));
      console.log('Admin password updated successfully!');
    } else {
      console.log('Creating admin user...');
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.insert(admins).values({
        username: username,
        password: hashedPassword
      });
      console.log('Admin user created successfully!');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();
