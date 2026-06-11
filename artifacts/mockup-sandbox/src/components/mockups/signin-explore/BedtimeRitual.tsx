import React from "react";
import "./_group.css";
import "./bedtime.css";

export function BedtimeRitual() {
  return (
    <div className="bedtime-ritual-wrapper">
      <div className="stars-overlay"></div>
      <div className="moon-glow"></div>
      <div className="moon-glow-2"></div>
      
      <div className="bedtime-content">
        <header className="bedtime-logo">
          <div className="bedtime-wordmark">
            <span className="bedtime-wordmark-woof">Woof</span>
            <span className="bedtime-wordmark-watcher">Watcher</span>
          </div>
        </header>

        <div className="bedtime-hero">
          <div className="bedtime-dog-wrapper">
            <img 
              src="/__mockup/images/woof-dog-cut.png" 
              alt="Peaceful dog resting" 
              className="bedtime-dog-img"
            />
          </div>
          <h1 className="bedtime-title">Tuck the pack in.</h1>
          <p className="bedtime-subtitle">
            Sign in to sync today's care logs and end the day with peace of mind.
          </p>
        </div>

        <div className="bedtime-form-panel">
          <div className="bedtime-input-group">
            <label className="bedtime-label">Email</label>
            <input 
              type="email" 
              className="bedtime-input" 
              placeholder="you@example.com" 
            />
          </div>
          
          <div className="bedtime-input-group">
            <label className="bedtime-label">Password</label>
            <input 
              type="password" 
              className="bedtime-input" 
              placeholder="••••••••" 
            />
            <a href="#" className="bedtime-forgot">Forgot password?</a>
          </div>

          <button className="bedtime-btn-primary">
            Sign in
          </button>

          <div className="bedtime-divider">
            <span className="bedtime-divider-text">or</span>
          </div>

          <button className="bedtime-btn-google">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>

        <div className="bedtime-footer">
          New here? <a href="#" className="bedtime-footer-link">Create an account</a>
        </div>
      </div>
    </div>
  );
}
