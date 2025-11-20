import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';

export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const registrations = pgTable('registrations', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  contactNumber: varchar('contact_number', { length: 20 }).notNull(),
  whatsappNumber: varchar('whatsapp_number', { length: 20 }),
  registrationCategory: varchar('registration_category', { length: 50 }).notNull(),
  yearOfStudying: varchar('year_of_studying', { length: 50 }),
  yearOfPassing: varchar('year_of_passing', { length: 10 }),
  paymentStatus: varchar('payment_status', { length: 20 }).notNull().default('pending'),
  razorpayOrderId: varchar('razorpay_order_id', { length: 255 }),
  razorpayPaymentId: varchar('razorpay_payment_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  paidAt: timestamp('paid_at')
});
