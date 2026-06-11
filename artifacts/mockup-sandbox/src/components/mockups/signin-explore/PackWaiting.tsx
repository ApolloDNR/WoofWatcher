import React, { useState } from "react";
import { Clock, Bone, Stethoscope, MapPin, CheckCircle2 } from "lucide-react";
import "./_group.css";
import "./pack-waiting.css";

export function PackWaiting() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="pw-container">
      <div className="pw-header">
        <div className="pw-wordmark">
          <span className="pw-wordmark-woof">Woof</span>
          <span className="pw-wordmark-watcher">Watcher</span>
        </div>
      </div>

      <div className="pw-pack-preview">
        <div className="pw-pack-header">
          <div className="pw-avatar-wrapper">
            <img src="/__mockup/images/woof-dog.png" alt="Phoenix" className="pw-avatar" />
            <div className="pw-status-dot"></div>
          </div>
          <div className="pw-pack-info">
            <h2 className="pw-pack-name">Phoenix's Day</h2>
            <div className="pw-pack-meta">
              <span>Your pack is active</span>
            </div>
          </div>
          <div className="pw-streak">
            <span>🔥</span>
            <span>12-day streak</span>
          </div>
        </div>

        <div className="pw-status-pills">
          <div className="pw-pill">
            <MapPin size={14} />
            <span>2 walks</span>
          </div>
          <div className="pw-pill">
            <Bone size={14} />
            <span>1 meal left</span>
          </div>
          <div className="pw-pill pw-pill-urgent">
            <Stethoscope size={14} />
            <span>Vet · Thu</span>
          </div>
        </div>

        <div className="pw-sync-status">
          <Clock size={12} />
          <span>Last synced 2h ago</span>
        </div>
      </div>

      <div className="pw-form-container">
        <h1 className="pw-form-header">Sign in to jump in</h1>
        <p className="pw-label" style={{ color: "var(--ww-muted)", marginBottom: "8px", marginTop: "-4px" }}>
          Keep your pack's care in sync.
        </p>

        <div className="pw-input-group">
          <label className="pw-label">Email</label>
          <input 
            type="email" 
            className="pw-input" 
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="pw-input-group">
          <label className="pw-label">Password</label>
          <input 
            type="password" 
            className="pw-input" 
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <a href="#" className="pw-forgot">Forgot password?</a>

        <button className="pw-btn-primary">
          Sign in
        </button>
      </div>

      <div className="pw-divider">or</div>

      <button className="pw-btn-google">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      <div className="pw-footer">
        New here? <a href="#" className="pw-link">Create an account</a>
      </div>
    </div>
  );
}
