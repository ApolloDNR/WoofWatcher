import React from "react";
import { 
  Bell, 
  ChevronDown, 
  Plus, 
  Home, 
  ListTodo, 
  Activity, 
  Menu,
  Bone,
  Coffee,
  Droplets,
  FileEdit,
  Footprints,
  CheckCircle2,
  Circle,
  Clock
} from "lucide-react";
import "./premium-playful.css";

export function PremiumPlayful() {
  return (
    <div className="premium-playful-container">
      {/* Top Bar */}
      <header className="pp-header">
        <div className="pp-header-top">
          <div className="pp-logo">
            <span className="pp-logo-woof">Woof</span>
            <span className="pp-logo-watcher">Watcher</span>
          </div>
          <button className="pp-icon-button">
            <Bell size={20} strokeWidth={2.5} />
            <span className="pp-notification-dot"></span>
          </button>
        </div>
        
        <div className="pp-greeting-row">
          <div className="pp-greeting">
            <h1>Good morning, Emma!</h1>
            <p>Let's make today a great day for Phoenix.</p>
          </div>
          <div className="pp-dog-switcher">
            <div className="pp-dog-avatar">
              <img src="/__mockup/images/woof-dog.png" alt="Phoenix" />
            </div>
            <ChevronDown size={16} strokeWidth={3} className="pp-switcher-icon" />
          </div>
        </div>
      </header>

      <main className="pp-main-content">
        {/* Hero Card */}
        <div className="pp-hero-card">
          <div className="pp-hero-image-wrapper">
            <img src="/__mockup/images/woof-dog.png" alt="Phoenix" className="pp-hero-image" />
            <div className="pp-mood-chip">
              <span className="pp-mood-emoji">😊</span> Joyful
            </div>
          </div>
          
          <div className="pp-hero-stats">
            <div className="pp-energy-row">
              <div className="pp-energy-label">Energy Level</div>
              <div className="pp-energy-value">82%</div>
            </div>
            <div className="pp-energy-bar-bg">
              <div className="pp-energy-bar-fill" style={{ width: '82%' }}></div>
            </div>
          </div>
          
          <div className="pp-next-up">
            <div className="pp-next-up-icon">
              <Clock size={16} strokeWidth={2.5} />
            </div>
            <div className="pp-next-up-text">
              <strong>Next up:</strong> Walk in 35 min · 8:30 AM
            </div>
          </div>
        </div>

        {/* Quick Log */}
        <section className="pp-section">
          <h2 className="pp-section-title">Quick Log</h2>
          <div className="pp-quick-log-row">
            <button className="pp-quick-log-btn">
              <div className="pp-ql-icon pp-ql-meal">
                <Bone size={22} />
              </div>
              <span>Meal</span>
            </button>
            <button className="pp-quick-log-btn">
              <div className="pp-ql-icon pp-ql-walk">
                <Footprints size={22} />
              </div>
              <span>Walk</span>
            </button>
            <button className="pp-quick-log-btn">
              <div className="pp-ql-icon pp-ql-potty">
                <Droplets size={22} />
              </div>
              <span>Potty</span>
            </button>
            <button className="pp-quick-log-btn">
              <div className="pp-ql-icon pp-ql-train">
                <Activity size={22} />
              </div>
              <span>Train</span>
            </button>
            <button className="pp-quick-log-btn">
              <div className="pp-ql-icon pp-ql-note">
                <FileEdit size={22} />
              </div>
              <span>Note</span>
            </button>
          </div>
        </section>

        {/* Today's Plan */}
        <section className="pp-section pp-mb-safe">
          <div className="pp-section-header">
            <h2 className="pp-section-title">Today's Plan</h2>
            <button className="pp-see-all">See all</button>
          </div>
          
          <div className="pp-plan-list">
            <div className="pp-plan-item pp-plan-done">
              <CheckCircle2 size={24} className="pp-plan-check" />
              <div className="pp-plan-content">
                <div className="pp-plan-title">Morning Potty</div>
                <div className="pp-plan-time">7:00 AM</div>
              </div>
            </div>
            
            <div className="pp-plan-item pp-plan-done">
              <CheckCircle2 size={24} className="pp-plan-check" />
              <div className="pp-plan-content">
                <div className="pp-plan-title">Breakfast</div>
                <div className="pp-plan-time">7:30 AM</div>
              </div>
            </div>
            
            <div className="pp-plan-item pp-plan-active">
              <Circle size={24} className="pp-plan-circle" />
              <div className="pp-plan-content">
                <div className="pp-plan-title">Morning Walk</div>
                <div className="pp-plan-time">8:30 AM</div>
              </div>
              <div className="pp-plan-tag">35 min</div>
            </div>
            
            <div className="pp-plan-item">
              <Circle size={24} className="pp-plan-circle" />
              <div className="pp-plan-content">
                <div className="pp-plan-title">Training Session</div>
                <div className="pp-plan-time">1:00 PM</div>
              </div>
            </div>
            
            <div className="pp-plan-item">
              <Circle size={24} className="pp-plan-circle" />
              <div className="pp-plan-content">
                <div className="pp-plan-title">Dinner</div>
                <div className="pp-plan-time">6:00 PM</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Tab Bar */}
      <nav className="pp-tab-bar">
        <button className="pp-tab-item pp-tab-active">
          <Home size={24} strokeWidth={2.5} />
          <span>Home</span>
        </button>
        <button className="pp-tab-item">
          <ListTodo size={24} strokeWidth={2.5} />
          <span>Log</span>
        </button>
        
        <div className="pp-tab-fab-container">
          <button className="pp-tab-fab">
            <Plus size={32} strokeWidth={3} color="#FFF" />
          </button>
        </div>
        
        <button className="pp-tab-item">
          <Activity size={24} strokeWidth={2.5} />
          <span>Health</span>
        </button>
        <button className="pp-tab-item">
          <Menu size={24} strokeWidth={2.5} />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
