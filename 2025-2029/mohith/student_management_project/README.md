# 🎓 TechBuddies - Student Management System

A comprehensive web-based Student Management System built with **Flask**, **SQLAlchemy**, and modern frontend technologies. Designed to streamline student administration, attendance tracking, and academic reporting.

---

## ✨ Features

### 📚 Student Management
- **Add & Manage Students**: Easily add, edit, and delete student records
- **Search Functionality**: Quickly find students by name with pagination support
- **Comprehensive Records**: Track student information including name, age, and enrolled courses

### 📊 Dashboard
- **Overview Analytics**: View total student count, average age, and course distribution
- **Insights**: Discover popular courses and track the latest enrollments
- **At-a-Glance Statistics**: Real-time metrics for quick decision-making

### 📋 Attendance System
- **Mark Attendance**: Record student attendance with Present/Absent status
- **Attendance History**: View complete attendance records with filtering by month
- **Performance Reports**: Calculate attendance percentages for each student
- **Data Export**: Download attendance reports as CSV files

### ⚙️ User Settings
- **Profile Management**: Update username and personal information
- **Security**: Change password with validation
- **Theme Support**: Toggle between Light and Dark modes
- **Session Management**: Secure logout functionality

### 🔐 Authentication
- **User Registration**: Create new user accounts with password confirmation
- **Secure Login**: Password-protected access with session management
- **Last Login Tracking**: Monitor user activity

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML5, CSS3, JavaScript |
| **Backend** | Flask (Python) |
| **Database** | SQLite with SQLAlchemy ORM |
| **Architecture** | MVC Pattern |
| **Version Control** | Git |

---

## 📦 Installation

### Prerequisites
- Python 3.7 or higher
- pip (Python package manager)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/Mohith1-stack/TechBuddies.git
   cd TechBuddies
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install Flask Flask-SQLAlchemy
   ```

4. **Run the application**
   ```bash
   python app.py
   ```

5. **Access the application**
   - Open your browser and navigate to `http://localhost:5000`
   - Register a new account or login with existing credentials

---

## 📁 Project Structure

```
TechBuddies/
├── app.py                 # Main Flask application with routes
├── models.py              # Database models (Student, User, Attendance)
├── requirements.txt       # Project dependencies
├── templates/             # HTML templates
│   ├── login.html
���   ├── register.html
│   ├── students.html
│   ├── attendance.html
│   ├── dashboard.html
│   ├── settings.html
│   └── edit_student.html
├── static/                # CSS, JavaScript, and assets
└── database/              # Database files
```

---

## 🚀 API Routes

| Route | Method | Description |
|-------|--------|------------|
| `/` | GET | Dashboard/Student list |
| `/login` | GET, POST | User authentication |
| `/register` | GET, POST | Account creation |
| `/add` | POST | Add new student |
| `/edit/<id>` | GET, POST | Edit student details |
| `/delete/<id>` | GET | Delete student |
| `/search` | GET | Search students |
| `/attendance` | GET, POST | View/mark attendance |
| `/save_attendance` | POST | Save attendance records |
| `/export` | GET | Export students as CSV |
| `/settings` | GET | User settings page |
| `/update_profile` | POST | Update user profile |
| `/change_password` | POST | Change user password |
| `/theme` | POST | Toggle theme |
| `/dashboard` | GET | View analytics dashboard |
| `/logout` | GET | User logout |

---

## 💾 Database Schema

### Student Table
- **id**: Integer - Primary key
- **name**: String - Student name
- **age**: Integer - Student age
- **course**: String - Enrolled course

### User Table
- **id**: Integer - Primary key
- **username**: String - Unique username
- **password**: String - User password
- **last_login**: String - Last login timestamp

### Attendance Table
- **id**: Integer - Primary key
- **student_id**: Integer - Foreign key (references Student)
- **date**: String - Attendance date
- **status**: String - Attendance status (Present/Absent)

---

## 🔑 Key Functionalities

### Authentication Flow
1. User registers with username and password
2. Credentials validated and stored in database
3. User logs in with credentials
4. Session created for user navigation
5. User must be logged in to access protected pages

### Attendance Workflow
1. View all students on attendance page
2. Mark attendance for each student
3. Submit attendance records
4. View historical records by month
5. Download attendance reports as CSV

### Dashboard Insights
- **Total Students**: Count of all enrolled students
- **Average Age**: Calculated from all student records
- **Course Distribution**: Number of unique courses
- **Popular Course**: Most enrolled course
- **Latest Enrollment**: Most recently added student

---

## 🎨 User Interface

- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Intuitive Navigation**: Clear navbar and menu structure
- **Theme Support**: Dark/Light mode for comfortable viewing
- **Visual Feedback**: Status messages and confirmations
- **Clean Cards Layout**: Modern card-based design for data presentation

---

## 🔒 Security Features

- Session-based authentication
- Password storage (Note: Consider hashing passwords in production)
- CSRF protection ready
- SQL injection prevention through SQLAlchemy ORM

---

## 🐛 Future Enhancements

- [ ] Password hashing and encryption
- [ ] Email notifications for attendance
- [ ] Parent/Guardian portal
- [ ] Grade management system
- [ ] Timetable scheduling
- [ ] Mobile app version
- [ ] Advanced reporting with charts
- [ ] Role-based access control (Admin, Teacher, Student)

---

## 📝 License

This project is open source and available under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Mohith1-stack** - [GitHub Profile](https://github.com/Mohith1-stack)

---

## 📧 Support & Contributing

We welcome contributions from the community! Please read our [contributing guidelines](CONTRIBUTING.md) for more information.

For issues, questions, or suggestions, please open an issue on the [GitHub repository](https://github.com/Mohith1-stack/TechBuddies/issues).

---

**Last Updated**: April 2026
