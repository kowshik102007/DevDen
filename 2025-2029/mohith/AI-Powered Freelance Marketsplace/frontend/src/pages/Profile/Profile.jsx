import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  User as UserIcon, Award, FileText, UploadCloud, AlertCircle, 
  CheckCircle, ArrowUpRight, Check, Sparkles, Star
} from 'lucide-react';
import { motion } from 'framer-motion';

export const Profile = () => {
  const { user, token, updateProfile, refreshUser } = useAuth();
  
  // Profile form states
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [title, setTitle] = useState(user?.profile?.title || '');
  const [bio, setBio] = useState(user?.profile?.bio || '');
  const [skills, setSkills] = useState(user?.profile?.skills_raw || '');
  const [company, setCompany] = useState(user?.profile?.company || '');
  
  // Resume analyser states
  const [resumeText, setResumeText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  
  // UI states
  const [profileSuccess, setProfileSuccess] = useState('');
  const [error, setError] = useState('');

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileSuccess('');
    setError('');
    
    try {
      const payload = {
        first_name: firstName,
        last_name: lastName
      };
      
      if (user.role === 'freelancer') {
        payload.title = title;
        payload.bio = bio;
        payload.skills = skills;
      } else {
        payload.company = company;
        payload.bio = bio;
      }
      
      await updateProfile(payload);
      setProfileSuccess("Profile updated successfully!");
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err) {
      setError(err.message || "Failed to update profile.");
    }
  };

  const handleAnalyzeResume = async (e) => {
    e.preventDefault();
    if (!resumeText) {
      setError("Please paste your resume text to analyze.");
      return;
    }
    
    setError('');
    setAnalyzing(true);
    setAnalysisResult(null);
    
    try {
      const formData = new FormData();
      formData.append('resume_text', resumeText);
      
      const res = await fetch('http://localhost:5000/api/users/resume/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Resume scanning failed");
      
      setAnalysisResult(data);
      await refreshUser(); // Fetch newly updated profile with ATS score
    } catch (err) {
      setError(err.message || "Failed to parse resume.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-white font-sans">Settings & Profile</h1>
        <p className="text-sm text-gray-400">Configure your professional listing and run AI resume ATS checkers.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3.5 rounded-lg bg-red-950/40 border border-red-900/40 text-red-300 text-xs max-w-xl">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {profileSuccess && (
        <div className="flex items-center gap-2 p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-900/40 text-emerald-300 text-xs max-w-xl">
          <CheckCircle size={16} />
          <span>{profileSuccess}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Profile Settings form */}
        <div className="glass-panel p-6 lg:col-span-2 space-y-6">
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-darkBorder pb-2.5">
            <UserIcon size={16} /> Basic Credentials
          </h3>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs text-white"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs text-white"
                  required
                />
              </div>
            </div>

            {user?.role === 'freelancer' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider">Professional Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Senior AI Engineer / UI/UX Expert"
                    className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs text-white"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider">Skills (comma separated)</label>
                  <input
                    type="text"
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder="Python, React, Figma, NLP"
                    className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs text-white"
                  />
                </div>
              </>
            )}

            {user?.role === 'client' && (
              <div className="space-y-1.5">
                <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider">Company name</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Acme Tech Corporation"
                  className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs text-white"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider">Bio & Description</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                placeholder="Write a brief profile description..."
                className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl p-4 text-xs text-white"
              />
            </div>

            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition text-xs shadow-glow"
            >
              Save Profile changes
            </button>
          </form>
        </div>

        {/* Side column: ATS Resume analyzer for freelancers, Profile stats for client */}
        <div className="space-y-6">
          {user?.role === 'freelancer' ? (
            <div className="glass-panel p-6 space-y-5">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-darkBorder pb-2.5">
                <FileText size={16} /> AI ATS Resume Scanner
              </h3>
              
              {user.profile?.resume_ats_score && (
                <div className="bg-slate-950 p-4 rounded-xl text-center space-y-2 border border-darkBorder">
                  <p className="text-xxs text-gray-400 uppercase">Current Resume ATS Score</p>
                  <p className={`text-3xl font-black ${user.profile.resume_ats_score >= 80 ? 'text-emerald-400' : 'text-yellow-500'}`}>
                    {user.profile.resume_ats_score} / 100
                  </p>
                  {user.profile.resume_suggestions && (
                    <p className="text-xxs text-gray-400 line-clamp-2">{user.profile.resume_suggestions}</p>
                  )}
                </div>
              )}

              <form onSubmit={handleAnalyzeResume} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider block">Paste Resume Text</label>
                  <textarea
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    rows={6}
                    placeholder="Paste full text copy of your resume..."
                    className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl p-3 text-xxs text-white"
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={analyzing}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-850 transition font-bold py-3 rounded-xl text-xs text-white flex items-center justify-center gap-1.5 shadow-cyanGlow"
                >
                  <UploadCloud size={16} />
                  {analyzing ? "AI Diagnosing..." : "Run ATS Scan"}
                </button>
              </form>
            </div>
          ) : (
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-darkBorder pb-2.5">
                <Award size={16} /> Client Profile Info
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Total Spent:</span>
                  <span className="font-extrabold text-white">₹{(user.profile?.total_spent || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Active projects:</span>
                  <span className="font-extrabold text-cyan-400">Escrow Protected</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full diagnostics details */}
      {analysisResult && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-6 space-y-6"
        >
          <div className="border-b border-darkBorder pb-3 flex items-center justify-between">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2 font-sans">
              <Sparkles className="text-cyan-400" size={20} /> AI ATS Resume Feedback Report
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-black ${
              analysisResult.ats_score >= 80 ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900' : 'bg-yellow-950/60 text-yellow-500 border border-yellow-900'
            }`}>
              ATS Grade: {analysisResult.ats_score}%
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wide">Detected keywords & Skills</h4>
                <div className="flex flex-wrap gap-2 pt-2">
                  {analysisResult.detected_skills?.map((sk, index) => (
                    <span key={index} className="text-xxs px-2.5 py-1 bg-slate-900 border border-darkBorder rounded text-gray-300">
                      {sk}
                    </span>
                  ))}
                  {!analysisResult.detected_skills?.length && <span className="text-xxs text-gray-500">None detected.</span>}
                </div>
              </div>
              
              <div>
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wide">Missing Key industry skills</h4>
                <div className="flex flex-wrap gap-2 pt-2">
                  {analysisResult.missing_skills?.map((sk, index) => (
                    <span key={index} className="text-xxs px-2.5 py-1 bg-red-950/20 border border-red-900/30 rounded text-red-400 font-semibold">
                      {sk}
                    </span>
                  ))}
                  {!analysisResult.missing_skills?.length && <span className="text-xxs text-gray-400">All key skills matched!</span>}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wide">Recommended improvements</h4>
                <ul className="space-y-2 pt-2 text-xxs text-gray-400">
                  {analysisResult.improvements?.map((imp, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold shrink-0">•</span>
                      <span>{imp}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wide">Career suggestions</h4>
                <ul className="space-y-2 pt-2 text-xxs text-gray-400">
                  {analysisResult.career_suggestions?.map((sug, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="text-emerald-400 shrink-0" size={12} />
                      <span>{sug}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
export default Profile;
