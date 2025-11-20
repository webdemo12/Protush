import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import bodyParser from 'body-parser';
import session from 'express-session';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import bcrypt from 'bcrypt';
import { db } from './db/index.js';
import { admins, registrations } from './db/schema.js';
import { eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 5000;

if (!process.env.SESSION_SECRET) {
    console.error('FATAL ERROR: SESSION_SECRET environment variable is required');
    process.exit(1);
}

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error('FATAL ERROR: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables are required');
    process.exit(1);
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


app.post('/api/create-order', async (req, res) => {
    try {
        const { amount, currency, email, name, contactNumber, whatsappNumber, registrationCategory, yearOfStudying, yearOfPassing } = req.body;

        if (!email || !name || !contactNumber || !registrationCategory || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: email, name, contactNumber, registrationCategory, and amount are required'
            });
        }

        if (typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid amount'
            });
        }

        const [newRegistration] = await db.insert(registrations).values({
            email,
            name,
            contactNumber,
            whatsappNumber: whatsappNumber || null,
            registrationCategory,
            yearOfStudying: yearOfStudying || null,
            yearOfPassing: yearOfPassing || null,
            paymentStatus: 'pending',
            razorpayOrderId: null,
            razorpayPaymentId: null
        }).returning();

        const options = {
            amount: amount,
            currency: currency || 'INR',
            receipt: `receipt_${Date.now()}`,
            notes: {
                registrationId: newRegistration.id,
                email: email,
                name: name
            }
        };

        const order = await razorpay.orders.create(options);
        
        await db.update(registrations)
            .set({ razorpayOrderId: order.id })
            .where(eq(registrations.id, newRegistration.id));

        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            registrationId: newRegistration.id
        });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create order'
        });
    }
});

app.post('/api/verify-payment', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, registrationId } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !registrationId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required payment verification fields'
            });
        }

        const registrationRecords = await db.select().from(registrations).where(eq(registrations.id, registrationId));
        
        if (registrationRecords.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Registration not found'
            });
        }

        const registration = registrationRecords[0];

        if (registration.razorpayOrderId !== razorpay_order_id) {
            return res.status(400).json({
                success: false,
                error: 'Order ID mismatch'
            });
        }

        const sign = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest('hex');

        if (razorpay_signature === expectedSign) {
            await db.update(registrations)
                .set({ 
                    paymentStatus: 'completed',
                    razorpayPaymentId: razorpay_payment_id,
                    paidAt: new Date()
                })
                .where(eq(registrations.id, registrationId));

            res.json({
                success: true,
                message: 'Payment verified successfully'
            });
        } else {
            await db.update(registrations)
                .set({ paymentStatus: 'failed' })
                .where(eq(registrations.id, registrationId));

            res.status(400).json({
                success: false,
                error: 'Invalid payment signature'
            });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Payment verification failed'
        });
    }
});

app.get('/api/registrations', async (req, res) => {
    if (!req.session.isAdmin) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized'
        });
    }

    try {
        const allRegistrations = await db.select().from(registrations);
        res.json({
            success: true,
            registrations: allRegistrations
        });
    } catch (error) {
        console.error('Error fetching registrations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch registrations'
        });
    }
});

app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            error: 'Username and password are required'
        });
    }

    try {
        const adminUsers = await db.select().from(admins).where(eq(admins.username, username));
        
        if (adminUsers.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        const admin = adminUsers[0];
        const passwordMatch = await bcrypt.compare(password, admin.password);

        if (passwordMatch) {
            req.session.isAdmin = true;
            req.session.username = username;
            res.json({
                success: true,
                message: 'Login successful'
            });
        } else {
            res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed. Please try again.'
        });
    }
});

app.get('/api/admin/check-auth', (req, res) => {
    if (req.session.isAdmin) {
        res.json({
            authenticated: true,
            username: req.session.username
        });
    } else {
        res.json({
            authenticated: false
        });
    }
});

app.post('/api/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                error: 'Logout failed'
            });
        }
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
    console.log('Environment check:');
    console.log('- RAZORPAY_KEY_ID: Set');
    console.log('- RAZORPAY_KEY_SECRET: Set');
    console.log('- SESSION_SECRET: Set');
    console.log('- DATABASE_URL: Set');
    console.log('\nServer started successfully!');
    console.log('Admin credentials are stored in the database.');
});
