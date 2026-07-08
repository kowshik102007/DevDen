# Queue Management System - API Documentation
**A model project by Jeevan A Jacob**

Base URL: `http://localhost:3000`

## Authentication
All protected routes require a Bearer token in the `Authorization` header.

### 1. Register
`POST /auth/register`
- Body: `{ "name": "...", "email": "...", "password": "..." }`
- Response: `{ "token": "...", "user": { ... } }`

### 2. Login
`POST /auth/login`
- Body: `{ "email": "...", "password": "..." }`
- Response: `{ "token": "...", "user": { ... } }`

---

## Clinics

### 3. Get All Clinics
`GET /clinics`
- Response: `[{ "id": 1, "name": "General Clinic", ... }]`

### 4. Create Clinic (Admin)
`POST /clinics`
- Body: `{ "name": "...", "description": "...", "avg_service_time": 15 }`

---

## Queues

### 5. Get Queue Tickets
`GET /queues`
- Query Params: `?clinic_id=1` (optional)

### 6. Join Queue
`POST /queues`
- Body: `{ "clinic_id": 1 }`
- Returns: Active ticket with position estimation.

### 7. Cancel Ticket
`DELETE /queues/{id}`

---

## Admin Controls

### 8. Call Next
`POST /admin/queue/next`
- Body: `{ "clinic_id": 1 }`

### 9. Reset Queue
`POST /admin/queue/reset`
- Body: `{ "clinic_id": 1 }`

---

## WebSocket
`ws://localhost:3000`
- Sends `{ "type": "QUEUE_UPDATE", "clinicId": ... }` whenever any ticket status in a clinic changes.
