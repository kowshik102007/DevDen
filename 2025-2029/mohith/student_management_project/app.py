from flask import Flask, render_template, request, redirect, session ,Response,request
from models import db, Student, User, Attendance
import csv

app = Flask(__name__)
app.secret_key = "password123"

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False 
db.init_app(app)
with app.app_context():
    db.create_all()

@app.route("/")
def home():
    if "user" not in session:
        return redirect("/login")
    page = request.args.get("page", 1, type=int)
    query = request.args.get("query", "")
    if query:
        students = Student.query.filter(
            Student.name.ilike(f"%{query}%")
        ).paginate(page=page, per_page=10)
    else:
        students = Student.query.paginate(page=page, per_page=10)
    return render_template("students.html", students=students, query=query)

@app.route("/search")
def search():
    query = request.args.get("query")
    students = Student.query.filter(
        Student.name.contains(query)
    ).all()
    return render_template("students.html", students=students, query=query)

@app.route("/add", methods=["POST"])
def add_student():
    name = request.form["name"]
    age = request.form["age"]
    course = request.form["course"]
    print("ADDING:", name)
    new_student = Student(name=name, age=age, course=course)
    db.session.add(new_student)
    db.session.commit()
    return redirect("/")

@app.route("/delete/<int:id>")
def delete_student(id):
    student = Student.query.get(id)
    db.session.delete(student)
    db.session.commit()
    return redirect("/")

@app.route("/edit/<int:id>", methods=["GET","POST"])
def edit_student(id):
    student = Student.query.get(id)
    if request.method == "POST":
        student.name = request.form["name"]
        student.age = request.form["age"]
        student.course = request.form["course"]
        db.session.commit()
        return redirect("/")
    return render_template("edit_student.html", student=student)

from datetime import datetime 

@app.route("/login", methods=["GET","POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        user = User.query.filter_by(username=username, password=password).first()
        if user:
            session["user"] = username
            user.last_login = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            db.session.commit()
            return redirect("/")
    return render_template("login.html")

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        confirm_password = request.form["confirm_password"]
        if password != confirm_password:
            return "Passwords do not match "
        new_user = User(username=username, password=password)
        db.session.add(new_user)
        db.session.commit()
        return redirect("/login")
    return render_template("register.html")

@app.route("/export")
def export_students():
    students = Student.query.all()
    def generate():
        yield "ID,Name,Age,Course\n"
        for s in students:
            yield f"{s.id},{s.name},{s.age},{s.course}\n"
    return Response(
        generate(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=students.csv"}
    )

@app.route("/update_profile", methods=["POST"])
def update_profile():
    username = request.form["username"]
    user = User.query.first()
    user.username = username
    db.session.commit()
    return redirect("/settings")

@app.route("/change_password", methods=["POST"])
def change_password():
    old_password = request.form["old_password"]
    new_password = request.form["new_password"]
    user = User.query.first()
    if user.password == old_password:
        user.password = new_password
        db.session.commit()
    return redirect("/settings")

@app.route("/theme", methods=["POST"])
def theme():
    theme = request.form["theme"]
    session["theme"] = theme
    return redirect("/settings")

@app.route("/attendance", methods=["GET", "POST"])
def attendance():
    students = Student.query.all()
    records = Attendance.query.all()
    report = []
    for student in students:
        total = Attendance.query.filter_by(student_id=student.id).count()
        present = Attendance.query.filter_by(
            student_id=student.id,
            status="Present"
        ).count()
        percentage = 0
        if total > 0:
            percentage = round((present / total) * 100, 2)
        report.append({
            "name": student.name,
            "total": total,
            "present": present,
            "percentage": percentage
        })
    month = request.args.get("month")
    monthly_records = []
    if month:
        monthly_records = Attendance.query.filter(
            Attendance.date.like(f"{month}%")
        ).all()
    return render_template(
        "attendance.html",
        students=students,
        records=records,
        report=report,
        monthly_records=monthly_records
    )

@app.route("/dashboard")
def dashboard():
    students = Student.query.all()
    
    total_students = len(students)
    ages = [s.age for s in students]
    if ages:
        avg_age = round(sum(ages) / len(ages))
    else:
        avg_age = 0
    
    total_courses = len(set([s.course for s in students]))

    from collections import Counter
    courses = [s.course for s in students]
    popular_course = Counter(courses).most_common(1)[0][0] if courses else "None"

    latest_student = Student.query.order_by(Student.id.desc()).first()
    user = User.query.first()
    last_login = getattr(user, "last_login", "No data")

    return render_template(
        "dashboard.html",
        total_students=total_students,
        avg_age=avg_age,
        total_courses=total_courses,
        popular_course=popular_course,
        latest_student=latest_student,
        last_login=last_login
    )

@app.route("/settings")
def settings():
    user = User.query.first()
    return render_template("settings.html", user=user)


@app.route("/save_attendance", methods=["POST"])
def save_attendance():
    from datetime import datetime
    date = datetime.now().strftime("%Y-%m-%d")
    students = Student.query.all()
    for student in students:
        status = request.form.get(f"status_{student.id}")
        if status:
            new_record = Attendance(
                student_id=student.id,
                status=status,
                date=date
            )
            db.session.add(new_record)
    db.session.commit()
    print("Attendance Saved")
    return redirect("/attendance")

@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect("/login")

if __name__ == "__main__":
    app.run(debug=True)
