-- SkillBridge AI Database Schema

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK(role IN ('freelancer', 'client', 'admin')),
    is_verified BOOLEAN DEFAULT 0,
    two_factor_secret VARCHAR(100) DEFAULT NULL,
    is_two_factor_enabled BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Freelancer Profiles Table
CREATE TABLE IF NOT EXISTS freelancer_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    title VARCHAR(255) DEFAULT '',
    bio TEXT DEFAULT '',
    skills TEXT DEFAULT '', -- Comma-separated list of skills
    experience TEXT DEFAULT '', -- JSON or text representation of experience
    certifications TEXT DEFAULT '', -- JSON or text of certs
    portfolio_links TEXT DEFAULT '', -- JSON list of URLs
    rating DECIMAL(3, 2) DEFAULT 0.00,
    completed_jobs INTEGER DEFAULT 0,
    earnings DECIMAL(15, 2) DEFAULT 0.00,
    resume_url TEXT DEFAULT '',
    resume_ats_score INTEGER DEFAULT NULL,
    resume_suggestions TEXT DEFAULT '',
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Client Profiles Table
CREATE TABLE IF NOT EXISTS client_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    company VARCHAR(255) DEFAULT '',
    bio TEXT DEFAULT '',
    total_spent DECIMAL(15, 2) DEFAULT 0.00,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Services (Gigs) Table
CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    freelancer_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    delivery_days INTEGER NOT NULL,
    category VARCHAR(100) NOT NULL,
    images_json TEXT DEFAULT '[]', -- JSON array of image URLs
    requirements TEXT DEFAULT '',
    active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(freelancer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    freelancer_id INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'delivered', 'revision_requested', 'completed', 'cancelled', 'refunded')),
    price DECIMAL(10, 2) NOT NULL,
    delivery_date TIMESTAMP NOT NULL,
    requirements_submitted TEXT DEFAULT '',
    delivery_attachment_url TEXT DEFAULT '',
    delivery_note TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP DEFAULT NULL,
    FOREIGN KEY(service_id) REFERENCES services(id),
    FOREIGN KEY(client_id) REFERENCES users(id),
    FOREIGN KEY(freelancer_id) REFERENCES users(id)
);

-- 6. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed', 'refunded')),
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    method VARCHAR(50) NOT NULL, -- 'UPI', 'Credit Card', 'Debit Card', 'Wallet', 'Net Banking'
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 7. Wallets Table
CREATE TABLE IF NOT EXISTS wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    pending_balance DECIMAL(15, 2) DEFAULT 0.00,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 8. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_id INTEGER NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK(type IN ('credit', 'debit')),
    description VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'completed' CHECK(status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
);

-- 9. Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    reviewer_id INTEGER NOT NULL,
    reviewee_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comment TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY(reviewer_id) REFERENCES users(id),
    FOREIGN KEY(reviewee_id) REFERENCES users(id)
);

-- 10. Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    content TEXT DEFAULT '',
    file_url TEXT DEFAULT '',
    file_type VARCHAR(50) DEFAULT '', -- 'image', 'document', 'archive', etc.
    is_read BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id),
    FOREIGN KEY(receiver_id) REFERENCES users(id)
);

-- 11. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT 0,
    type VARCHAR(100) DEFAULT 'general', -- 'order', 'payment', 'message', 'review'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 12. Support Tickets Table
CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'closed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 13. Refunds Table
CREATE TABLE IF NOT EXISTS refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    reason TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 14. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER DEFAULT NULL,
    action TEXT NOT NULL,
    ip_address VARCHAR(45) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
