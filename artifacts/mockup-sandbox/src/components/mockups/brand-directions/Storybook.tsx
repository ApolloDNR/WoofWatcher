import React from "react";
import { 
  Menu, 
  ChevronDown, 
  Bell, 
  Bone, 
  MapPin, 
  Droplets, 
  Award, 
  FileText,
  CheckCircle2,
  Circle,
  Clock,
  Home,
  List,
  HeartPulse,
  MoreHorizontal,
  Plus
} from "lucide-react";
import "./storybook.css";

export function Storybook() {
  return (
    <div className="storybook-app">
      {/* Top Bar */}
      <header className="px-5 pt-12 pb-4 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm">
            <img 
              src="https://api.dicebear.com/7.x/notionists/svg?seed=Emma&backgroundColor=DCE9EF" 
              alt="Emma" 
              className="w-full h-full object-cover bg-[#DCE9EF]"
            />
          </button>
          <div>
            <p className="text-xs text-[#8DA48E] font-medium tracking-wide uppercase mb-0.5">Good Morning</p>
            <div className="flex items-center gap-1.5">
              <span className="storybook-font-serif text-lg font-bold text-[#0E1B2D]">Emma & Phoenix</span>
              <ChevronDown size={16} className="text-[#0E1B2D] opacity-60" />
            </div>
          </div>
        </div>
        
        <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-[#0E1B2D]">
          <Bell size={20} strokeWidth={1.5} />
        </button>
      </header>

      <main className="px-5 flex flex-col gap-6">
        
        {/* Wordmark */}
        <div className="flex justify-center my-2">
          <h1 className="storybook-font-serif text-2xl font-bold tracking-tight">
            <span className="text-[#0E1B2D]">Woof</span>
            <span className="text-[#C66A2E]">Watcher</span>
          </h1>
        </div>

        {/* Hero Section */}
        <div className="relative rounded-[28px] overflow-hidden bg-[#DCE9EF] pb-4">
          <div className="h-48 w-full relative">
            <img 
              src="/__mockup/images/dog-storybook.png" 
              alt="Phoenix in a magical meadow" 
              className="w-full h-full object-cover"
            />
            {/* Gradient overlay to blend bottom into the card */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#DCE9EF] to-transparent h-full w-full"></div>
            
            {/* Mood Pill */}
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-2 shadow-sm">
              <span className="text-lg">✨</span>
              <span className="text-sm font-semibold text-[#0E1B2D]">Joyful</span>
            </div>
          </div>

          <div className="px-5 relative z-10 -mt-8">
            <div className="bg-white rounded-[20px] p-5 shadow-sm border border-white/50">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <h2 className="storybook-font-serif text-[28px] font-bold text-[#0E1B2D] leading-none mb-1">Phoenix</h2>
                  <p className="text-[#8DA48E] text-sm">is happy and energetic</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-[#0E1B2D]">87<span className="text-base font-semibold text-[#8DA48E]">%</span></span>
                </div>
              </div>
              
              <div className="storybook-progress-bar h-2.5 rounded-full w-full mb-4">
                <div className="storybook-progress-fill h-full w-[87%]"></div>
              </div>

              <div className="flex items-center gap-2 text-[#0E1B2D] bg-[#F9F8F6] p-3 rounded-xl border border-[#0E1B2D]/5">
                <div className="bg-[#BFD6B1]/30 p-1.5 rounded-lg text-[#8DA48E]">
                  <Clock size={16} strokeWidth={2} />
                </div>
                <p className="text-sm font-medium"><span className="opacity-60">Next up:</span> <span className="font-bold">Walk in 35 min</span> <span className="opacity-40">· 8:30 AM</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Log */}
        <div>
          <div className="flex justify-between items-center mb-3 px-1">
            <h3 className="storybook-font-serif text-lg font-bold text-[#0E1B2D]">Quick Log</h3>
          </div>
          <div className="flex justify-between gap-2 overflow-x-auto pb-2 -mx-5 px-5 snap-x hide-scrollbar">
            {[
              { icon: Bone, label: "Meal", color: "#F47A45", bg: "#FFF2EC" },
              { icon: MapPin, label: "Walk", color: "#8DA48E", bg: "#F1F5F1" },
              { icon: Droplets, label: "Potty", color: "#6B90A0", bg: "#EEF3F5" },
              { icon: Award, label: "Treat", color: "#C66A2E", bg: "#FDF5F0" },
              { icon: FileText, label: "Note", color: "#0E1B2D", bg: "#F2F3F4" },
            ].map((item, i) => (
              <button key={i} className="storybook-quick-log-btn flex flex-col items-center justify-center w-[72px] h-[84px] shrink-0 snap-start">
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1.5" style={{ backgroundColor: item.bg, color: item.color }}>
                  <item.icon size={20} strokeWidth={1.5} />
                </div>
                <span className="text-xs font-medium text-[#0E1B2D] opacity-80">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quote Card */}
        <div className="bg-[#0E1B2D] rounded-[20px] p-6 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#1A2A42] rounded-full blur-3xl -mr-10 -mt-10 opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#C66A2E] rounded-full blur-3xl -ml-10 -mb-10 opacity-20"></div>
          
          <p className="storybook-font-serif text-[#F9F8F6] text-[17px] leading-relaxed italic relative z-10">
            "We watch over the little things — so you can enjoy the big adventures."
          </p>
        </div>

        {/* Today's Plan */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4 px-1">
            <h3 className="storybook-font-serif text-lg font-bold text-[#0E1B2D]">Today's Plan</h3>
            <button className="text-sm font-medium text-[#C66A2E]">Edit</button>
          </div>
          
          <div className="bg-white rounded-[24px] p-2 shadow-sm border border-[#0E1B2D]/5">
            {[
              { time: "7:00 AM", title: "Breakfast", icon: Bone, done: true },
              { time: "8:30 AM", title: "Morning Walk", icon: MapPin, done: false, active: true },
              { time: "12:00 PM", title: "Potty Break", icon: Droplets, done: false },
              { time: "5:00 PM", title: "Training Session", icon: Award, done: false },
              { time: "6:00 PM", title: "Dinner", icon: Bone, done: false },
            ].map((task, i) => (
              <div key={i} className={`flex items-center p-3 rounded-[16px] ${task.active ? 'bg-[#F9F8F6]' : ''}`}>
                <div className="mr-3">
                  {task.done ? (
                    <CheckCircle2 size={24} className="text-[#8DA48E] fill-[#8DA48E]/10" strokeWidth={1.5} />
                  ) : (
                    <Circle size={24} className={`text-[#0E1B2D] ${task.active ? 'opacity-40' : 'opacity-20'}`} strokeWidth={1.5} />
                  )}
                </div>
                <div className="flex-1 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${task.done ? 'bg-[#8DA48E]/10 text-[#8DA48E]' : task.active ? 'bg-[#C66A2E]/10 text-[#C66A2E]' : 'bg-[#0E1B2D]/5 text-[#0E1B2D]/40'}`}>
                      <task.icon size={16} strokeWidth={1.5} />
                    </div>
                    <span className={`font-medium ${task.done ? 'text-[#0E1B2D]/50 line-through' : 'text-[#0E1B2D]'}`}>{task.title}</span>
                  </div>
                  <span className={`text-sm ${task.done ? 'text-[#0E1B2D]/40' : task.active ? 'text-[#C66A2E] font-medium' : 'text-[#0E1B2D]/40'}`}>{task.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* Bottom Tab Bar */}
      <nav className="storybook-bottom-bar fixed bottom-0 w-full max-w-[390px] h-[84px] px-6 pb-6 pt-3 flex justify-between items-center z-50 rounded-t-[32px]">
        <button className="flex flex-col items-center gap-1 text-[#0E1B2D]">
          <Home size={24} strokeWidth={2} className="fill-[#0E1B2D]/10" />
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-[#0E1B2D]/40 hover:text-[#0E1B2D] transition-colors">
          <List size={24} strokeWidth={2} />
          <span className="text-[10px] font-medium">Log</span>
        </button>
        
        <div className="relative -top-5">
          <button className="storybook-fab w-14 h-14 rounded-full flex items-center justify-center border-4 border-[#F9F8F6]">
            <Plus size={28} strokeWidth={2} />
          </button>
        </div>
        
        <button className="flex flex-col items-center gap-1 text-[#0E1B2D]/40 hover:text-[#0E1B2D] transition-colors">
          <HeartPulse size={24} strokeWidth={2} />
          <span className="text-[10px] font-medium">Health</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-[#0E1B2D]/40 hover:text-[#0E1B2D] transition-colors">
          <MoreHorizontal size={24} strokeWidth={2} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>
      
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
