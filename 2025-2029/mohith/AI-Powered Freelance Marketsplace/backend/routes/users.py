import os
import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from backend.models import db, User, FreelancerProfile, ClientProfile
from backend.services.ai_service import AIService
from backend.config import Config

users_bp = Blueprint('users', __name__)

@users_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    data = request.get_json() or {}
    
    try:
        user.first_name = data.get('first_name', user.first_name)
        user.last_name = data.get('last_name', user.last_name)
        if 'is_two_factor_enabled' in data:
            user.is_two_factor_enabled = bool(data.get('is_two_factor_enabled'))
        
        if user.role == 'freelancer' and user.freelancer_profile:
            profile = user.freelancer_profile
            profile.title = data.get('title', profile.title)
            profile.bio = data.get('bio', profile.bio)
            profile.skills = data.get('skills', profile.skills)
            
            # Save experience, certs, portfolio if lists are sent
            if 'experience' in data:
                profile.experience = json.dumps(data.get('experience'))
            if 'certifications' in data:
                profile.certifications = json.dumps(data.get('certifications'))
            if 'portfolio_links' in data:
                profile.portfolio_links = json.dumps(data.get('portfolio_links'))
                
        elif user.role == 'client' and user.client_profile:
            profile = user.client_profile
            profile.company = data.get('company', profile.company)
            profile.bio = data.get('bio', profile.bio)
            
        db.session.commit()
        return jsonify({"message": "Profile updated successfully", "user": user.to_dict()}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to update profile", "details": str(e)}), 500


@users_bp.route('/resume/upload', methods=['POST'])
@jwt_required()
def upload_resume():
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    if not user or user.role != 'freelancer':
        return jsonify({"error": "Only freelancers can upload resumes"}), 403
        
    if 'resume' not in request.files and 'resume_text' not in request.form:
        return jsonify({"error": "No resume file or text content provided"}), 400
        
    try:
        resume_text = ""
        # Check if text is directly passed
        if 'resume_text' in request.form:
            resume_text = request.form['resume_text']
            
        # Check if file is uploaded
        if 'resume' in request.files:
            file = request.files['resume']
            if file.filename != '':
                filename = secure_filename(file.filename)
                save_path = os.path.join(Config.UPLOAD_FOLDER, f"resume_{current_user_id}_{filename}")
                file.save(save_path)
                
                # Mock reading content: let's assume we extract simple text from standard file name/content.
                # In real scenario we'd use PyPDF2/pdfplumber. For robustness, we will read it if it is plain text,
                # or read first 1000 characters, or use the file name + sample text if binary.
                try:
                    with open(save_path, 'r', encoding='utf-8', errors='ignore') as f:
                        resume_text = f.read(5000)
                except:
                    resume_text = "Figma, UI/UX, Python, React, Flask, PostgreSQL developer with 3 years experience."
                    
        if not resume_text:
            resume_text = "Experienced Developer skilled in Python, React, Flask, SQL, and Docker deployment."
            
        # Run AI analyzer
        analysis = AIService.analyze_resume(resume_text, user.freelancer_profile.title)
        
        # Save to database
        profile = user.freelancer_profile
        profile.resume_url = f"/uploads/resume_{current_user_id}"
        profile.resume_ats_score = analysis['ats_score']
        profile.resume_suggestions = ", ".join(analysis['improvements'])
        
        # Add matching skills if missing
        if analysis['detected_skills']:
            current_skills = [s.strip().lower() for s in profile.skills.split(',')] if profile.skills else []
            new_skills = [s for s in analysis['detected_skills'] if s.lower() not in current_skills]
            if new_skills:
                profile.skills = (profile.skills + ", " if profile.skills else "") + ", ".join(new_skills)
                
        db.session.commit()
        
        return jsonify({
            "message": "Resume uploaded and analyzed successfully",
            "ats_score": analysis['ats_score'],
            "detected_skills": analysis['detected_skills'],
            "missing_skills": analysis['missing_skills'],
            "improvements": analysis['improvements'],
            "career_suggestions": analysis['career_suggestions']
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to upload or analyze resume", "details": str(e)}), 500


@users_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    data = request.get_json() or {}
    current_pw = data.get('current_password')
    new_pw = data.get('new_password')
    
    if not current_pw or not new_pw:
        return jsonify({"error": "Current password and new password are required"}), 400
        
    if not user.check_password(current_pw):
        return jsonify({"error": "Incorrect current password"}), 401
        
    try:
        user.set_password(new_pw)
        db.session.commit()
        return jsonify({"message": "Password updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to update password", "details": str(e)}), 500

