-- Seed script for SkillBridge AI Database
-- Password for all seeded users is "password123" (Werkzeug pbkdf2:sha256 hash or similar, we will verify dynamically)
-- Let's use simple hashes that we'll match in backend code if needed, or we'll allow standard comparisons.
-- We seed password_hash using a placeholder representing 'password123' hashed value.

-- 1. Seed Users
-- Admin
INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_verified)
VALUES (1, 'admin@skillbridge.ai', 'pbkdf2:sha256:260000$g76S1yF9$05d8f6d8928b5840b3c69c6bc0fbef640be2f31b6dfbb23961234b9d09c25603', 'System', 'Admin', 'admin', 1);

-- Freelancers
INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_verified)
VALUES (2, 'alex.ai@skillbridge.ai', 'pbkdf2:sha256:260000$g76S1yF9$05d8f6d8928b5840b3c69c6bc0fbef640be2f31b6dfbb23961234b9d09c25603', 'Alex', 'Rivera', 'freelancer', 1);

INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_verified)
VALUES (3, 'sarah.design@skillbridge.ai', 'pbkdf2:sha256:260000$g76S1yF9$05d8f6d8928b5840b3c69c6bc0fbef640be2f31b6dfbb23961234b9d09c25603', 'Sarah', 'Kohn', 'freelancer', 1);

INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_verified)
VALUES (4, 'david.dev@skillbridge.ai', 'pbkdf2:sha256:260000$g76S1yF9$05d8f6d8928b5840b3c69c6bc0fbef640be2f31b6dfbb23961234b9d09c25603', 'David', 'Chen', 'freelancer', 1);

-- Clients
INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_verified)
VALUES (5, 'client.startup@gmail.com', 'pbkdf2:sha256:260000$g76S1yF9$05d8f6d8928b5840b3c69c6bc0fbef640be2f31b6dfbb23961234b9d09c25603', 'Elena', 'Petrova', 'client', 1);

INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_verified)
VALUES (6, 'client.corp@gmail.com', 'pbkdf2:sha256:260000$g76S1yF9$05d8f6d8928b5840b3c69c6bc0fbef640be2f31b6dfbb23961234b9d09c25603', 'Marcus', 'Aurelius', 'client', 1);


-- 2. Seed Freelancer Profiles
INSERT INTO freelancer_profiles (id, user_id, title, bio, skills, experience, rating, completed_jobs, earnings, resume_ats_score, resume_suggestions)
VALUES (1, 2, 'Senior AI Engineer & LLM Specialist', 'I design and deploy fine-tuned LLMs, custom agents, and RAG architectures using LangChain, OpenAI, and Gemini. 5+ years in neural network design.', 'Python, LangChain, OpenAI API, PyTorch, Gemini, Vector DBs, Prompt Engineering', '[{"role": "AI Architect", "company": "NeuralFlow", "duration": "3 years"}, {"role": "Data Scientist", "company": "ByteCorp", "duration": "2 years"}]', 4.95, 24, 125000.00, 85, 'Add specific production deployment metrics to your AI engineer projects.');

INSERT INTO freelancer_profiles (id, user_id, title, bio, skills, experience, rating, completed_jobs, earnings, resume_ats_score, resume_suggestions)
VALUES (2, 3, 'Expert UI/UX & Graphic Designer', 'Creating beautiful, human-centered UI/UX designs for web & mobile apps. Proficient in Figma, Adobe XD, and Illustrator. 6+ years styling modern websites.', 'Figma, Adobe Creative Suite, Wireframing, CSS Grid, Responsive Design, Branding', '[{"role": "Lead Designer", "company": "PixelPerfect Studios", "duration": "4 years"}]', 4.88, 42, 84000.00, 92, 'Highlight React/Tailwind frontend collaboration projects.');

INSERT INTO freelancer_profiles (id, user_id, title, bio, skills, experience, rating, completed_jobs, earnings, resume_ats_score, resume_suggestions)
VALUES (3, 4, 'Full-Stack Web Developer (React & Flask)', 'Building reliable, high-performance web applications. Expertise in React, Node, Flask, PostgreSQL, and AWS deployment.', 'React.js, Flask, PostgreSQL, Docker, AWS, JavaScript, Python, REST APIs, Git', '[{"role": "Full-Stack Dev", "company": "SaaSForge", "duration": "2 years"}]', 4.75, 18, 45000.00, 78, 'List database schema migration and performance tuning skills.');


-- 3. Seed Client Profiles
INSERT INTO client_profiles (id, user_id, company, bio, total_spent)
VALUES (1, 5, 'Aether AI (YC W24)', 'Building the future of developer tools with autonomous agents.', 12000.00);

INSERT INTO client_profiles (id, user_id, company, bio, total_spent)
VALUES (2, 6, 'Imperium Tech', 'Global enterprise software systems provider.', 3500.00);


-- 4. Seed Services (Gigs)
-- AI services
INSERT INTO services (id, freelancer_id, title, description, price, delivery_days, category, images_json, requirements, active)
VALUES (1, 2, 'I will build an AI Chatbot with custom Knowledge Base (RAG)', 'Need a smart assistant for your company website that knows everything about your products? I will build a highly customized chatbot using LangChain, Gemini API/OpenAI API, and Pinecone vector database. Includes a clean chat interface and easy integration instructions.', 5000.00, 5, 'Artificial Intelligence', '["/images/ai-chatbot-1.png", "/images/ai-chatbot-2.png"]', 'Provide your PDF/text documentation and preferred API key configurations.', 1);

INSERT INTO services (id, freelancer_id, title, description, price, delivery_days, category, images_json, requirements, active)
VALUES (2, 2, 'I will fine-tune LLM models for specific domains', 'I will perform dataset curation and fine-tune open-source models like Llama 3 or Mistral on your specialized dataset. Excellent for legal, medical, or corporate operations. Deliverables include model weights, quantization files, and API endpoints.', 15000.00, 10, 'Artificial Intelligence', '["/images/llm-finetuning.png"]', 'Domain-specific training datasets in json/csv format.', 1);

-- Graphic Design services
INSERT INTO services (id, freelancer_id, title, description, price, delivery_days, category, images_json, requirements, active)
VALUES (3, 3, 'I will create a Premium UI/UX Design for your SaaS Platform', 'Get a modern, stunning, and highly engaging UI/UX design that hooks your users. I will deliver a complete interactive Figma design file, customized design system (components, buttons, colors), and clickable prototypes for both desktop and mobile.', 6000.00, 7, 'Graphic Design', '["/images/saas-ui-1.png", "/images/saas-ui-2.png"]', 'SaaS project description, list of competitors, and branding assets if any.', 1);

INSERT INTO services (id, freelancer_id, title, description, price, delivery_days, category, images_json, requirements, active)
VALUES (4, 3, 'I will design a modern Logo and Brand Guidelines', 'Elevate your brand identity. I will design a minimal, clean, and memorable logo for your startup. Deliverables include vector formats (SVG, EPS, PDF), colored & monochrome versions, and a 10-page brand guide explaining fonts and color rules.', 2500.00, 3, 'Graphic Design', '["/images/branding-logo.png"]', 'Brand name, tagline, target audience, and preferred design style.', 1);

-- Web Development services
INSERT INTO services (id, freelancer_id, title, description, price, delivery_days, category, images_json, requirements, active)
VALUES (5, 4, 'I will develop a Full-Stack React & Flask Web Application', 'Need a production-ready web application? I will write clean React frontend code integrated with a secure Flask REST API and PostgreSQL database. Features standard JWT login, role management, responsive tables, and AWS deployment script.', 10000.00, 8, 'Web Development', '["/images/fullstack-react-flask.png"]', 'Detailed wireframe, list of pages, database requirements, and API specifications.', 1);

-- 5. Seed Wallets
INSERT INTO wallets (id, user_id, balance, pending_balance) VALUES (1, 1, 1500.00, 0.00);    -- Admin
INSERT INTO wallets (id, user_id, balance, pending_balance) VALUES (2, 2, 8500.00, 5000.00); -- Alex Rivera (Freelancer)
INSERT INTO wallets (id, user_id, balance, pending_balance) VALUES (3, 3, 4000.00, 0.00);    -- Sarah Kohn (Freelancer)
INSERT INTO wallets (id, user_id, balance, pending_balance) VALUES (4, 4, 2500.00, 10000.00); -- David Chen (Freelancer)
INSERT INTO wallets (id, user_id, balance, pending_balance) VALUES (5, 5, 2000.00, 0.00);    -- Elena (Client)
INSERT INTO wallets (id, user_id, balance, pending_balance) VALUES (6, 6, 9500.00, 0.00);    -- Marcus (Client)


-- 6. Seed Transactions
INSERT INTO transactions (wallet_id, amount, type, description, status)
VALUES (2, 5000.00, 'credit', 'Payment for Gig: AI Chatbot (Order #1001)', 'completed');
INSERT INTO transactions (wallet_id, amount, type, description, status)
VALUES (5, 5000.00, 'debit', 'Payment for Gig: AI Chatbot (Order #1001)', 'completed');
INSERT INTO transactions (wallet_id, amount, type, description, status)
VALUES (3, 4000.00, 'credit', 'Payment for Brand Guidelines (Order #1002)', 'completed');


-- 7. Seed Orders
-- Complete Order
INSERT INTO orders (id, service_id, client_id, freelancer_id, status, price, delivery_date, created_at, completed_at, requirements_submitted)
VALUES (1001, 1, 5, 2, 'completed', 5000.00, '2026-06-20 12:00:00', '2026-06-15 10:00:00', '2026-06-19 15:30:00', 'We need a chatbot that parses customer FAQs.');

-- Active Order
INSERT INTO orders (id, service_id, client_id, freelancer_id, status, price, delivery_date, created_at, requirements_submitted)
VALUES (1002, 5, 6, 4, 'active', 10000.00, '2026-07-05 18:00:00', '2026-06-27 09:15:00', 'Create a booking engine for medical clinics.');


-- 8. Seed Reviews
INSERT INTO reviews (order_id, reviewer_id, reviewee_id, rating, comment)
VALUES (1001, 5, 2, 5, 'Alex built an excellent custom chatbot in record time. Highly skilled in LangChain and very professional communication!');


-- 9. Seed Messages
INSERT INTO messages (sender_id, receiver_id, content, is_read, created_at)
VALUES (5, 2, 'Hi Alex, I just ordered the AI Chatbot gig. Do you need any more inputs?', 1, '2026-06-15 10:05:00');
INSERT INTO messages (sender_id, receiver_id, content, is_read, created_at)
VALUES (2, 5, 'Hello Elena! Thanks for the hire. Please share the FAQ doc link so I can initialize the vector store database.', 1, '2026-06-15 10:15:00');
INSERT INTO messages (sender_id, receiver_id, content, is_read, created_at)
VALUES (5, 2, 'Sure, here is the pdf: https://example.com/docs/faq.pdf. Let me know if you need anything else!', 1, '2026-06-15 10:30:00');


-- 10. Seed Notifications
INSERT INTO notifications (user_id, content, is_read, type)
VALUES (2, 'New Order received for: I will build an AI Chatbot (Order #1001)', 1, 'order');
INSERT INTO notifications (user_id, content, is_read, type)
VALUES (5, 'Your payment of ₹5000 for Order #1001 was processed successfully.', 1, 'payment');


-- 11. Seed Support Tickets
INSERT INTO support_tickets (user_id, subject, message, status)
VALUES (5, 'Refund Request - Order #1003', 'The freelancer was unresponsive and missed the deadline by 4 days. Please issue a full refund to my wallet.', 'open');
