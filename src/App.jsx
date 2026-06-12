import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Video, 
  RefreshCw, 
  Send, 
  Trash2, 
  X, 
  MessageSquare, 
  History, 
  Camera, 
  Volume2, 
  VolumeX, 
  Terminal, 
  Users, 
  Eye, 
  ShieldAlert, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  Play
} from 'lucide-react';
import MediaPipeHolisticCanvas from './components/MediaPipeHolisticCanvas';
import MediaPipeHandCanvas from './components/MediaPipeHandCanvas';
import { useHolisticFaceLandmarks } from './hooks/useHolisticFaceLandmarks';
import { useChamChamGame } from './hooks/useChamChamGame';

export default function App() {
  // Navigation & Screen Control
  const [isPlaying, setIsPlaying] = useState(false); // false = landing page, true = matching/chat workspace
  const [isMatching, setIsMatching] = useState(false); // loading screen spinner
  const [matchingStatus, setMatchingStatus] = useState("Looking for someone cool...");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Identity / Setup State
  const [nickname, setNickname] = useState(() => localStorage.getItem("neo_user_name") || "Anonymoid");
  const [topicInterests, setTopicInterests] = useState([]);
  const [manualInterest, setManualInterest] = useState("");

  // Stranger Data
  const [stranger, setStranger] = useState(null);
  const [chatLog, setChatLog] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [isStrangerTyping, setIsStrangerTyping] = useState(false);

  // Audio / Media Settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("none"); // none, brutal, neon, cyber, ascii
  const [toastMessage, setToastMessage] = useState("");

  // History State
  const [historySessions, setHistorySessions] = useState(() => {
    try {
      const saved = localStorage.getItem("neo_omegle_history");
      const parsed = saved ? JSON.parse(saved) : [];
      if (parsed.length === 0) {
        return [
          {
            key: "session_mock_1",
            strangerAlias: "PixelPirate",
            strangerAvatarColor: "#66FF66",
            interests: ["css-art", "retro-gaming", "web-art"],
            startTime: "06/09/2026, 10:15 AM",
            messages: [
              { id: "sys-1", role: "system", text: "Connected with a random stranger! They are interested in css-art, retro-gaming, web-art.", timestamp: "10:15 AM" },
              { id: "str-1", role: "stranger", text: "ahoy matey! you build css-art with zero external dependencies too?", timestamp: "10:15 AM" },
              { id: "usr-1", role: "user", text: "Absolutely, thick borders and solid box shadows are my jam!", timestamp: "10:16 AM" },
              { id: "str-2", role: "stranger", text: "brutal! i love the raw layouts. high contrast rules the web!", timestamp: "10:16 AM" },
              { id: "sys-2", role: "system", text: "You have disconnected from the chat session.", timestamp: "10:18 AM" }
            ]
          },
          {
            key: "session_mock_2",
            strangerAlias: "CosmicGazer",
            strangerAvatarColor: "#B266FF",
            interests: ["science-fiction", "stars", "analog-synths"],
            startTime: "06/09/2026, 09:42 AM",
            messages: [
              { id: "sys-3", role: "system", text: "Connected with a random stranger! They are interested in science-fiction, stars, analog-synths.", timestamp: "09:42 AM" },
              { id: "str-3", role: "stranger", text: "have you ever listened to old analog sci-fi synthesizer soundtracks under a starry sky?", timestamp: "09:42 AM" },
              { id: "usr-3", role: "user", text: "Yes! Vangelis style is legendary.", timestamp: "09:43 AM" },
              { id: "str-4", role: "stranger", text: "exactly, tape echo and detuned oscillators create magic! 🪐", timestamp: "09:44 AM" },
              { id: "sys-4", role: "system", text: "You have disconnected from the chat session.", timestamp: "09:45 AM" }
            ]
          },
          {
            key: "session_mock_3",
            strangerAlias: "MemeAlchemist",
            strangerAvatarColor: "#FF66AA",
            interests: ["vaporwave", "lofi-hiphop", "retro-gaming"],
            startTime: "06/08/2026, 11:30 PM",
            messages: [
              { id: "sys-5", role: "system", text: "Connected with a random stranger! They are interested in vaporwave, lofi-hiphop, retro-gaming.", timestamp: "11:30 PM" },
              { id: "str-5", role: "stranger", text: "A E S T H E T I C S. what retro console are you gaming on tonight?", timestamp: "11:31 PM" },
              { id: "usr-5", role: "user", text: "Standard NES emulation on my custom desktop grid!", timestamp: "11:32 PM" },
              { id: "str-6", role: "stranger", text: "perfect choice. that brutal color palette is timeless.", timestamp: "11:33 PM" },
              { id: "sys-6", role: "system", text: "You have disconnected from the chat session.", timestamp: "11:35 PM" }
            ]
          }
        ];
      }
      return parsed;
    } catch {
      return [];
    }
  });
  const [viewingPastSessionKey, setViewingPastSessionKey] = useState(null);

  // References
  const localVideoRef = useRef(null);
  const messagesEndRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const { landmarksRef } = useHolisticFaceLandmarks(localVideoRef, cameraActive);

  // Preset interests for neobrutalist vibe
  const presetInterests = [
    "neobrutalism", "css-art", "retro-gaming", "analog-synths", 
    "science-fiction", "graphic-design", "espresso", "vinyl-records",
    "vaporwave", "lofi-hiphop", "urban-sketching", "web-art"
  ];

  // Auto-scroll chat area
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog, isStrangerTyping]);

  // Persist user nickname
  useEffect(() => {
    localStorage.setItem("neo_user_name", nickname);
  }, [nickname]);

  // Save changes to history sessions in localStorage
  useEffect(() => {
    localStorage.setItem("neo_omegle_history", JSON.stringify(historySessions));
  }, [historySessions]);

  // Handle Toast Notifications
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 4000);
  };

  // Beep synthesizer helper - no external asset file needed!
  const playSynthesizerBeep = (freq = 440, duration = 0.15, type = "sine") => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Synth audio blocked or failed:", e);
    }
  };

  const playGameTickBeep = useCallback(() => {
    playSynthesizerBeep(540, 0.1, 'triangle');
  }, [soundEnabled]);

  const playGameSuccessBeep = useCallback(() => {
    if (!soundEnabled) return;
    playSynthesizerBeep(740, 0.07, 'square');
    setTimeout(() => playSynthesizerBeep(988, 0.07, 'square'), 70);
    setTimeout(() => playSynthesizerBeep(1318, 0.14, 'square'), 140);
  }, [soundEnabled]);

  const playGameFailBeep = useCallback(() => {
    playSynthesizerBeep(160, 0.45, 'sawtooth');
  }, [soundEnabled]);

  const chamChamGame = useChamChamGame({
    landmarksRef,
    onTickBeep: playGameTickBeep,
    onSuccessBeep: playGameSuccessBeep,
    onFailBeep: playGameFailBeep,
  });

  // Setup Web Camera
  const toggleCamera = async () => {
    if (cameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setCameraActive(false);
      triggerToast("Webcam disabled");
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setCameraActive(true);
        triggerToast("Vibrant webcam stream is live! Try the styling filters!");
        playSynthesizerBeep(650, 0.25, "triangle");
      } catch (err) {
        setCameraActive(false);
        triggerToast("Camera access denied or unavailable. Running in simulated retro-visualizer mode.");
        playSynthesizerBeep(300, 0.35, "sawtooth");
      }
    }
  };

  // Cleanup camera stream
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Update stream when cameraActive is true on mount
  useEffect(() => {
    if (cameraActive && localVideoRef.current && streamRef.current) {
      localVideoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  // Enter matching mode
  const startMatching = () => {
    // Exit past view
    setViewingPastSessionKey(null);
    setIsPlaying(true);
    setIsMatching(true);
    setStranger(null);
    setChatLog([]);
    playSynthesizerBeep(880, 0.1, "sine");

    // Dynamic phase text while matching
    const phases = [
      "Securing connection interfaces...",
      "Analyzing 1,284 neobrutalist graphic grid nodes...",
      "Matching shared interests tags...",
      "Establishing server handshakes on port 3000...",
      "Handshake verified! Loading stranger persona...",
    ];

    let currentPhaseIdx = 0;
    setMatchingStatus(phases[0]);

    const interval = setInterval(() => {
      currentPhaseIdx++;
      if (currentPhaseIdx < phases.length) {
        setMatchingStatus(phases[currentPhaseIdx]);
        playSynthesizerBeep(400 + (currentPhaseIdx * 80), 0.08, "triangle");
      } else {
        clearInterval(interval);
        retrieveStrangerMatch();
      }
    }, 100);
  };

  // Fetch the randomized Stranger match from server
  const retrieveStrangerMatch = async () => {
    try {
      const response = await fetch("/api/stranger");
      if (!response.ok) throw new Error("Server matchmaking offline");
      const data = await response.json();

      setStranger(data);
      setIsMatching(false);

      // Play success chime
      playSynthesizerBeep(523.25, 0.15, "sine"); // C5
      setTimeout(() => playSynthesizerBeep(659.25, 0.15, "sine"), 120); // E5
      setTimeout(() => playSynthesizerBeep(783.99, 0.25, "sine"), 240); // G5

      // Setup initial chat log with System greeting
      const systemWelcome = `Connected with a random stranger! They are interested in ${data.interests.join(", ")}.`;
      const initialLog = [
        { id: "sys-connect", role: "system", text: systemWelcome, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ];
      setChatLog(initialLog);

      // Trigger standard initial response after a delay
      setIsStrangerTyping(true);
      setTimeout(async () => {
        setIsStrangerTyping(false);
        const strangerGreeting = `hey standard user! i'm listed as ${data.alias}. what's up? (interests: ${data.interests.slice(0, 3).join(", ")})`;
        const responseLog = [
          ...initialLog,
          { id: "stranger-greeting", role: "stranger", text: strangerGreeting, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ];
        setChatLog(responseLog);
        playSynthesizerBeep(587.33, 0.1, "sine"); // D5
        
        // Push initial session skeleton to live history
        const sessionKey = `session_${Date.now()}`;
        const newSession = {
          key: sessionKey,
          strangerAlias: data.alias,
          strangerAvatarColor: data.avatarColor,
          interests: data.interests,
          startTime: new Date().toLocaleString(),
          messages: responseLog
        };
        setHistorySessions(prev => [newSession, ...prev]);
        setViewingPastSessionKey(sessionKey); // reference key to update later
      }, 1200);

    } catch (err) {
      console.error(err);
      setIsMatching(false);
      triggerToast("Error matching with server. Simulated offline matching instead!");
      
      // Fallback offline simulated stranger
      const mockStranger = {
        id: "offline-mock",
        alias: "OfflineGridMaster",
        age: 23,
        location: "Outer Orbit",
        interests: ["neobrutalism", "css", "thick-borders"],
        avatarColor: "#FF85B3"
      };
      setStranger(mockStranger);
      const systemWelcome = `Connected with OfflineGridMaster in offline container simulation!`;
      setChatLog([
        { id: "sys-connect", role: "system", text: systemWelcome, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
    }
  };

  const quitToLanding = () => {
    chamChamGame.stopGame();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
    setIsMatching(false);
    setIsPlaying(false);
  };

  // Stop current matching chat or exit simulator
  const disconnectChat = () => {
    if (!chatLog.length) {
      setIsPlaying(false);
      return;
    }

    playSynthesizerBeep(261.63, 0.3, "sawtooth"); // Low C beep
    // Add system disclaimer
    const closeTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatLog(prev => [
      ...prev,
      { id: `sys-disconnect-${Date.now()}`, role: "system", text: "You have disconnected from the chat session.", timestamp: closeTimestamp }
    ]);
    
    // Save final messages version to past sessions
    if (viewingPastSessionKey) {
      setHistorySessions(prev => prev.map(s => {
        if (s.key === viewingPastSessionKey) {
          return {
            ...s,
            messages: [
              ...chatLog,
              { id: `sys-disconnect-${Date.now()}`, role: "system", text: "You have disconnected from the chat session.", timestamp: closeTimestamp }
            ]
          };
        }
        return s;
      }));
    }

    setStranger(null);
    triggerToast("Chat session archive successfully stored in sidebar!");
  };

  // Sending message logic
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || !stranger) return;

    const textToSend = userInput.trim();
    setUserInput("");
    playSynthesizerBeep(880, 0.05, "sine");

    const messageTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsgNode = {
      id: `user-${Date.now()}`,
      role: "user",
      text: textToSend,
      timestamp: messageTime
    };

    const newLogs = [...chatLog, userMsgNode];
    setChatLog(newLogs);

    // Save progressively to history
    if (viewingPastSessionKey) {
      setHistorySessions(prev => prev.map(s => {
        if (s.key === viewingPastSessionKey) {
          return { ...s, messages: newLogs };
        }
        return s;
      }));
    }

    // Trigger stranger text reply simulation or Gemini API
    setIsStrangerTyping(true);

    try {
      // Structure the history in standard { role: "user" | "model", text: "..." } format
      const formattedHistory = newLogs
        .filter(msg => msg.role === "user" || msg.role === "stranger")
        .map(msg => ({
          role: msg.role === "user" ? "user" : "model",
          text: msg.text
        }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: formattedHistory,
          stranger: stranger
        })
      });

      if (!response.ok) throw new Error("API Route error");
      const data = await response.json();

      setIsStrangerTyping(false);
      
      const strangerMsgNode = {
        id: `stranger-${Date.now()}`,
        role: "stranger",
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const revisedLogs = [...newLogs, strangerMsgNode];
      setChatLog(revisedLogs);
      playSynthesizerBeep(480, 0.1, "triangle");

      // Update the saved history log reference
      if (viewingPastSessionKey) {
        setHistorySessions(prev => prev.map(s => {
          if (s.key === viewingPastSessionKey) {
            return { ...s, messages: revisedLogs };
          }
          return s;
        }));
      }

    } catch (err) {
      console.error(err);
      setIsStrangerTyping(false);
      // Fallback response block
      const fallbackReplies = [
        "that sounds super vibrant! tell me more context.",
        "pardon? my css stylesheet had an outline overflow for a sec, let's reset that topic.",
        "whoa, sweet layout feedback! so what country or territory are you representing?",
        "perfect! let's talk about fanzine alignments or CRT pixel monitors!"
      ];
      const selectedFallback = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
      
      const strangerMsgNode = {
        id: `stranger-${Date.now()}`,
        role: "stranger",
        text: `[OFFLINE SIMULATOR] ${selectedFallback}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const revisedLogs = [...newLogs, strangerMsgNode];
      setChatLog(revisedLogs);
      playSynthesizerBeep(320, 0.15, "sawtooth");

      if (viewingPastSessionKey) {
        setHistorySessions(prev => prev.map(s => {
          if (s.key === viewingPastSessionKey) {
            return { ...s, messages: revisedLogs };
          }
          return s;
        }));
      }
    }
  };

  // Interest manipulation functions
  const addInterest = (interestStr) => {
    const cleanStr = interestStr.trim().toLowerCase();
    if (!cleanStr) return;
    if (topicInterests.includes(cleanStr)) {
      triggerToast("Interest tag already included in matching blueprint!");
      return;
    }
    setTopicInterests([...topicInterests, cleanStr]);
    playSynthesizerBeep(700, 0.08, "sine");
  };

  const removeInterest = (indexToRemove) => {
    setTopicInterests(topicInterests.filter((_, idx) => idx !== indexToRemove));
    playSynthesizerBeep(350, 0.05, "triangle");
  };

  const handleInterestKeySubmit = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addInterest(manualInterest);
      setManualInterest("");
    }
  };

  // Review a past historical chat session
  const selectPastSession = (session) => {
    setViewingPastSessionKey(session.key);
    setChatLog(session.messages);
    
    // Set simulated stranger to let user review their layout metrics
    setStranger({
      alias: session.strangerAlias,
      interests: session.interests,
      avatarColor: session.strangerAvatarColor,
      offlineReview: true
    });
    setIsPlaying(true);
    triggerToast(`Viewing archive chat with ${session.strangerAlias}`);
    playSynthesizerBeep(640, 0.12, "sine");
  };

  // Remove individual history log
  const deleteHistorySession = (sessionKey, e) => {
    e.stopPropagation();
    setHistorySessions(prev => prev.filter(s => s.key !== sessionKey));
    if (viewingPastSessionKey === sessionKey) {
      setViewingPastSessionKey(null);
      setStranger(null);
      setChatLog([]);
    }
    triggerToast("Archive session discarded.");
    playSynthesizerBeep(220, 0.2, "sawtooth");
  };

  // Reset entire history database
  const clearAllHistory = () => {
    if (window.confirm("Are you positive you'd like to completely purge your brutalist chat history?")) {
      setHistorySessions([]);
      setViewingPastSessionKey(null);
      setStranger(null);
      setChatLog([]);
      triggerToast("All historical data purged successfully!");
      playSynthesizerBeep(180, 0.4, "sawtooth");
    }
  };

  return (
    <div className="neo-app">
      {/* Toast alert system widget */}
      {toastMessage && (
        <div className="neo-toast" id="system-toast">
          <Terminal size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Brand Header Bar */}
      <header className="neo-header" id="app-header">
        <div className="neo-logo-group" onClick={() => setIsPlaying(false)}>
          <div className="neo-logo" style={{ cursor: "pointer" }}>
            --
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {/* Audio volume switch */}



          {/* Pull history arrow trigger sitting on right top corner */}
          {!sidebarOpen && (
            <button
              id="pull-history-btn"
              className="neo-btn neo-btn-sm"
              style={{ backgroundColor: "var(--color-cyan)", border: "var(--neo-border-thin)", boxShadow: "var(--neo-shadow-sm)" }}
              onClick={() => {
                setSidebarOpen(true);
                playSynthesizerBeep(600, 0.08, "triangle");
              }}
              title="Pull out Chat Archives"
            >
              <ChevronLeft size={16} />
              <span>HISTORY</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container Area */}
      <div className="neo-main-content">
        {/* Dynamic Inner Viewport Area */}
        <div className="neo-view-viewport">
          {!isPlaying ? (
            /* ================= LANDING SCREEN ================= */
            <div className="landing-page" id="landing-screen">
              <div className="hero-card">
                
                <h1 className="hero-title">
                  CHAM CHAM CHAM ONLINE
                </h1>
                
                <p className="hero-subtitle">
                  cham,,cham,,CHAM!
                </p>

                {/* Set user credential box */}
                <div className="setup-box" style={{ maxWidth: "500px", margin: "0 auto 2.5rem auto", width: "100%" }}>
                  <div>
                    <label className="form-label" htmlFor="user-moniker">Nickname</label>
                    <input 
                      type="text" 
                      id="user-moniker"
                      className="form-input" 
                      // value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="e.g. Cham_Go_su"
                    />
                  </div>
                </div>

                {/* Action grid block buttons */}
                <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", justifyContent: "center" }}>
                  <button 
                    className="neo-btn neo-btn-pink"
                    style={{ fontSize: "1.4rem", padding: "1rem 2.5rem" }}
                    onClick={startMatching}
                    id="btn-start-match"
                  >
                    <Video size={24} />
                    Start Matchmaking
                  </button>
                </div>

                {/* Security Warning Disclaimer */}
                
              </div>
            </div>
          ) : (
            /* ================= WORKSPACE SCREEN (Active Video Chat) ================= */
            <div className="chat-workspace" id="chat-session-workspace">
              {/* MATCHING SCREEN OVERLAY LOAD PANEL */}
              {isMatching && (
                <div className="matching-overlay" id="matching-spinner">
                  <div className="radar-spinner-container">
                    <div className="radar-sweep"></div>
                    <div className="radar-target" style={{ top: "40%", left: "60%" }}></div>
                    <div className="radar-target" style={{ top: "20%", left: "30%" }}></div>
                  </div>
                  
                  <h3 className="hero-title" style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>
                    Searching for a Match
                  </h3>

                  <button 
                    className="neo-btn neo-btn-sm" 
                    style={{ marginTop: "2.5rem", backgroundColor: "var(--color-orange)", color: "white" }}
                    onClick={() => setIsPlaying(false)}
                  >
                    Cancel Matchmaking
                  </button>
                </div>
              )}

              {/* LEFT COLUMN: VISUAL PANELS */}
              <div className="visual-panels">
                {/* Controls bar */}
                <div className="visual-title-row">
                  <div className="visual-title-text">
                    ---
                  </div>
                  
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button 
                      className={`neo-btn neo-btn-sm ${cameraActive ? "neo-btn-green" : ""}`}
                      onClick={toggleCamera}
                      title="Toggle Local Webcam Hardware"
                    >
                      <Camera size={14} />
                      <span>{cameraActive ? "Cam Live" : "Turn Cam On"}</span>
                    </button>
                  </div>
                </div>

                {/* Video Grid row */}
                <div className="video-frame-container">
                  {/* Visual frame 1: YOU */}
                  <div className="video-frame">
                    <div className="video-label-tag">
                      You ({nickname})
                    </div>

                    <MediaPipeHolisticCanvas
                      videoRef={localVideoRef}
                      isActive={cameraActive}
                      label={nickname}
                      filterName={selectedFilter}
                      landmarksRef={landmarksRef}
                      gameActive={chamChamGame.gameActive}
                      gameCue={chamChamGame.gameCue}
                      countdown={chamChamGame.countdown}
                    />

                    {cameraActive && (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ display: 'none' }}
                      />
                    )}
                  </div>
                  
                  <div className="video-frame">
                    {/* <div className="video-label-tag video-label-tag-pink">
                      Hand ({nickname})
                    </div>

                    <MediaPipeHandCanvas
                      videoRef={localVideoRef}
                      isActive={cameraActive}
                      label={nickname}
                    />

                    {cameraActive && (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ display: 'none' }}
                      />
                    )} */}
                  </div>

                </div>

                {/* Dynamic Action row under visual feed */}
                <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                  {chamChamGame.showScore && (
                    <div className={`game-score-display ${chamChamGame.gamePhase === 'gameOver' ? 'game-score-display--over' : ''}`}>
                      Score: {chamChamGame.score}
                      {chamChamGame.gamePhase === 'gameOver' ? ' · Game Over' : ''}
                    </div>
                  )}

                  <button
                    className={`neo-btn neo-btn-sm ${chamChamGame.canStart && cameraActive && chamChamGame.gamePhase !== 'playing' ? 'neo-btn-green' : ''}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      padding: "0.6rem 1rem",
                      opacity: chamChamGame.canStart && cameraActive && chamChamGame.gamePhase !== 'playing' ? 1 : 0.45,
                      cursor: chamChamGame.canStart && cameraActive && chamChamGame.gamePhase !== 'playing' ? 'pointer' : 'not-allowed',
                    }}
                    onClick={chamChamGame.startGame}
                    disabled={!cameraActive || chamChamGame.gamePhase === 'playing'}
                    title={chamChamGame.canStart ? 'Start the game' : 'Tilt your head left or right to start'}
                  >
                    <Play size={14} />
                    <span>Start</span>
                  </button>

                  <button 
                    className="neo-btn neo-btn-sm" 
                    style={{ backgroundColor: "var(--color-orange)", display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.6rem 1rem" }}
                    onClick={quitToLanding}
                  >
                    <X size={14} />
                    <span>Quit</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PERSISTENT RIGHT-SIDEBAR FOR CHAT ARCHIVES (Vertically long box that sticks on the right) */}
        <aside className={`neo-sidebar ${sidebarOpen ? "" : "collapsed"}`} id="history-sidebar">
          <div className="sidebar-headline">
            <span className="sidebar-title">📁 Chat Archives</span>
            <button 
              className="neo-btn neo-btn-sm" 
              style={{ border: "2px solid #000", padding: "0.2rem", boxShadow: "none" }}
              onClick={() => {
                setSidebarOpen(false);
                playSynthesizerBeep(300, 0.08, "triangle");
              }}
            >
              <X size={14} />
            </button>
          </div>

          <div className="sidebar-scroller">
            {/* Box element inside showing the name of the previous partner/session, and the time */}
            

            {historySessions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "1.5rem 1rem", fontStyle: "italic", fontSize: "0.8rem", color: "#666" }}>
                No automated saved archives found. Connect and exchange details to log a session.
              </div>
            ) : (
              historySessions.map((session) => {
                const isActive = viewingPastSessionKey === session.key;
                // Get last message snippet
                const textMsgs = session.messages.filter(m => m.role === "user" || m.role === "stranger");
                const lastSnippet = textMsgs.length > 0 ? textMsgs[textMsgs.length - 1].text : "No messages saved";
                
                return (
                  <div 
                    key={session.key} 
                    className={`past-session-item ${isActive ? "active" : ""}`}
                    style={{ borderLeft: `6px solid ${session.strangerAvatarColor}` }}
                  >
                    <div className="past-session-topic">
                      <span style={{ fontWeight: "700" }}>{session.strangerAlias}</span>
                    </div>
                    <div className="past-session-date">
                      {session.startTime}
                    </div>
                    <div className="past-session-snippet">
                    </div>
                  </div>
                );
              })
            )}\
          </div>

        </aside>
      </div>

      {/* Persistent Outer Footer */}
    </div>
  );
}