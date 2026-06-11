import React from "react";
import { Dog, Activity, Check, Plus, Home, Book, Heart, Menu, Utensils, Footprints, Droplets, Bone, Edit3 } from "lucide-react";
import "./NeoRetro.css";

export function NeoRetro() {
  return (
    <div className="neo-retro-container pb-24">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 border-b-4 border-[#1A2238] bg-[#FDFCDC] z-10 sticky top-0">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="neo-retro-pixel-font text-sm font-bold text-[#1A2238]">
              WOOF<span className="text-[#E36414]">WATCHER</span>
            </h1>
          </div>
          <span className="text-xl">Good morning, Emma!</span>
        </div>
        <div className="neo-retro-box px-3 py-1 flex items-center gap-2 cursor-pointer bg-[#A2D2FF]">
          <Dog size={16} />
          <span className="neo-retro-pixel-font text-[10px]">PHOENIX</span>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-6">
        {/* Hero Pet Area */}
        <div className="neo-retro-box-blue p-4 flex flex-col items-center relative">
          <div className="absolute top-2 right-2 bg-[#FDFCDC] border-2 border-[#1A2238] px-2 py-1 transform rotate-6">
            <span className="neo-retro-pixel-font text-[8px] text-[#E36414]">LEVEL UP!</span>
          </div>
          
          <div className="w-32 h-32 bg-[#FDFCDC] border-4 border-[#1A2238] flex items-center justify-center mb-4 overflow-hidden rounded-full relative">
            <div className="absolute inset-0 bg-[#A2D2FF] opacity-20"></div>
            <img 
              src="/__mockup/images/dog-pixel.png" 
              alt="Phoenix the Husky" 
              className="w-24 h-24 object-contain pixel-art drop-shadow-md z-10"
            />
          </div>

          <div className="flex flex-col w-full gap-3 mb-2">
            <div className="flex justify-between items-center w-full">
              <span className="neo-retro-pixel-font text-[10px]">MOOD: JOYFUL</span>
              <span className="neo-retro-pixel-font text-[10px]">LVL 12</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="neo-retro-pixel-font text-[8px] w-12">NRG</span>
              <div className="flex flex-1">
                {[1,2,3,4,5,6,7].map(i => <div key={`nrg-${i}`} className={`stat-block ${i <= 6 ? 'filled-mint' : 'empty'}`} />)}
              </div>
              <span className="text-xl">85%</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="neo-retro-pixel-font text-[8px] w-12">HNG</span>
              <div className="flex flex-1">
                {[1,2,3,4,5,6,7].map(i => <div key={`hng-${i}`} className={`stat-block ${i <= 4 ? 'filled-orange' : 'empty'}`} />)}
              </div>
              <span className="text-xl">60%</span>
            </div>
          </div>
          
          <div className="w-full mt-2 bg-[#FDFCDC] border-2 border-[#1A2238] p-2 text-center">
            <p className="text-lg">NEXT UP: WALK IN 35 MIN • 8:30 AM</p>
          </div>
        </div>

        {/* Quick Log */}
        <div className="flex flex-col gap-2">
          <h2 className="neo-retro-pixel-font text-[10px] text-[#1A2238]">QUICK LOG</h2>
          <div className="flex justify-between gap-2 overflow-x-auto pb-2">
            {[
              { icon: Utensils, label: "MEAL", color: "bg-[#E36414]", text: "text-white" },
              { icon: Footprints, label: "WALK", color: "bg-[#8FE388]", text: "text-[#1A2238]" },
              { icon: Droplets, label: "POTTY", color: "bg-[#A2D2FF]", text: "text-[#1A2238]" },
              { icon: Bone, label: "TREAT", color: "bg-[#FDFCDC]", text: "text-[#1A2238]" },
              { icon: Edit3, label: "NOTE", color: "bg-[#1A2238]", text: "text-[#FDFCDC]" },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-1 min-w-[60px]">
                <button className={`w-14 h-14 ${item.color} border-4 border-[#1A2238] flex items-center justify-center box-shadow-sm active:translate-y-1 transition-transform`}>
                  <item.icon size={20} className={item.text} />
                </button>
                <span className="neo-retro-pixel-font text-[8px] mt-1">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Banner */}
        <div className="neo-retro-box-navy p-4 flex flex-col items-center text-center">
          <h3 className="neo-retro-pixel-font text-[10px] leading-loose text-[#A2D2FF]">
            YOU CARE. THEY THRIVE.
            <br />LEVEL UP TOGETHER.
          </h3>
        </div>

        {/* Today's Plan */}
        <div className="flex flex-col gap-3">
          <h2 className="neo-retro-pixel-font text-[10px] text-[#1A2238] mb-1">TODAY'S MISSION</h2>
          
          <div className="flex flex-col gap-2">
            {[
              { task: "MORNING KIBBLE", time: "7:00 AM", done: true, type: "meal" },
              { task: "PARK PATROL (WALK)", time: "8:30 AM", done: false, type: "walk" },
              { task: "POTTY BREAK", time: "12:00 PM", done: false, type: "potty" },
              { task: "SIT & STAY TRAINING", time: "3:00 PM", done: false, type: "train" },
            ].map((item, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 border-4 border-[#1A2238] ${item.done ? 'bg-[#8FE388]' : 'bg-[#FDFCDC]'}`}>
                <div className={`w-6 h-6 border-2 border-[#1A2238] flex items-center justify-center bg-white ${item.done ? '' : 'cursor-pointer'}`}>
                  {item.done && <Check size={16} strokeWidth={4} className="text-[#1A2238]" />}
                </div>
                <div className="flex flex-col flex-1">
                  <span className={`text-xl ${item.done ? 'line-through opacity-70' : ''}`}>{item.task}</span>
                  <span className="neo-retro-pixel-font text-[8px] opacity-80">{item.time}</span>
                </div>
                {item.done && <div className="neo-retro-pixel-font text-[8px] text-[#1A2238] bg-[#FDFCDC] px-1 border border-[#1A2238]">+10 XP</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[390px] mx-auto tab-bar-retro flex justify-around items-center h-20 px-2 z-50">
        <button className="flex flex-col items-center gap-1 p-2 text-[#E36414]">
          <Home size={24} strokeWidth={2.5} />
          <span className="neo-retro-pixel-font text-[8px]">HOME</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 text-[#1A2238] opacity-60">
          <Book size={24} />
          <span className="neo-retro-pixel-font text-[8px]">LOG</span>
        </button>
        
        <div className="relative -top-5">
          <button className="w-16 h-16 bg-[#E36414] rounded-full border-4 border-[#1A2238] flex items-center justify-center shadow-[0_4px_0_#1A2238] active:translate-y-1 active:shadow-none transition-all">
            <Plus size={32} color="#FDFCDC" strokeWidth={3} />
          </button>
        </div>
        
        <button className="flex flex-col items-center gap-1 p-2 text-[#1A2238] opacity-60">
          <Heart size={24} />
          <span className="neo-retro-pixel-font text-[8px]">HEALTH</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 text-[#1A2238] opacity-60">
          <Menu size={24} />
          <span className="neo-retro-pixel-font text-[8px]">MORE</span>
        </button>
      </div>
    </div>
  );
}
