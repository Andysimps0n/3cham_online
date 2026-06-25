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
  Play,
  Copy,
  UserPlus,
  Home
} from 'lucide-react';
import { startModelDownload } from './assets/preloadModel';
import MediaPipeHolisticCanvas from './components/MediaPipeHolisticCanvas';
import MediaPipeHandCanvas from './components/MediaPipeHandCanvas';
import { useHolisticFaceLandmarks } from './hooks/useHolisticFaceLandmarks';
import { useChamChamGame } from './hooks/useChamChamGame';
import { useMatchmaking } from './hooks/useMatchmaking';
import {
  deserializeFaceLandmarks,
  PEER_LANDMARK_SEND_INTERVAL_MS,
  PEER_LANDMARK_STALE_MS,
  serializeFaceLandmarks,
} from './tracking/landmarkSync';

const HISTORY_STORAGE_KEY = 'neo_omegle_history_v2';

const MOCK_SESSIONS = [
  {
    key: 'session_mock_1',
    strangerAlias: 'PixelPirate',
    strangerAvatarColor: '#66FF66',
    interests: ['css-art', 'retro-gaming', 'web-art'],
    startTime: '06/09/2026, 10:15 AM',
    messages: [
      { id: 'sys-1', role: 'system', text: 'Connected with a random stranger! They are interested in css-art, retro-gaming, web-art.', timestamp: '10:15 AM' },
      { id: 'str-1', role: 'stranger', text: 'ahoy matey! you build css-art with zero external dependencies too?', timestamp: '10:15 AM' },
      { id: 'usr-1', role: 'user', text: 'Absolutely, thick borders and solid box shadows are my jam!', timestamp: '10:16 AM' },
      { id: 'str-2', role: 'stranger', text: 'brutal! i love the raw layouts. high contrast rules the web!', timestamp: '10:16 AM' },
      { id: 'sys-2', role: 'system', text: 'You have disconnected from the chat session.', timestamp: '10:18 AM' },
    ],
  },
  {
    key: 'session_mock_2',
    strangerAlias: 'CosmicGazer',
    strangerAvatarColor: '#B266FF',
    interests: ['science-fiction', 'stars', 'analog-synths'],
    startTime: '06/09/2026, 09:42 AM',
    messages: [
      { id: 'sys-3', role: 'system', text: 'Connected with a random stranger! They are interested in science-fiction, stars, analog-synths.', timestamp: '09:42 AM' },
      { id: 'str-3', role: 'stranger', text: 'have you ever listened to old analog sci-fi synthesizer soundtracks under a starry sky?', timestamp: '09:42 AM' },
      { id: 'usr-3', role: 'user', text: 'Yes! Vangelis style is legendary.', timestamp: '09:43 AM' },
      { id: 'str-4', role: 'stranger', text: 'exactly, tape echo and detuned oscillators create magic! 🪐', timestamp: '09:44 AM' },
      { id: 'sys-4', role: 'system', text: 'You have disconnected from the chat session.', timestamp: '09:45 AM' },
    ],
  },
  {
    key: 'session_mock_3',
    strangerAlias: 'MemeAlchemist',
    strangerAvatarColor: '#FF66AA',
    interests: ['vaporwave', 'lofi-hiphop', 'retro-gaming'],
    startTime: '06/08/2026, 11:30 PM',
    messages: [
      { id: 'sys-5', role: 'system', text: 'Connected with a random stranger! They are interested in vaporwave, lofi-hiphop, retro-gaming.', timestamp: '11:30 PM' },
      { id: 'str-5', role: 'stranger', text: 'A E S T H E T I C S. what retro console are you gaming on tonight?', timestamp: '11:31 PM' },
      { id: 'usr-5', role: 'user', text: 'Standard NES emulation on my custom desktop grid!', timestamp: '11:32 PM' },
      { id: 'str-6', role: 'stranger', text: 'perfect choice. that brutal color palette is timeless.', timestamp: '11:33 PM' },
      { id: 'sys-6', role: 'system', text: 'You have disconnected from the chat session.', timestamp: '11:35 PM' },
    ],
  },
];

function loadHistorySessions() {
  try {
    const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return parsed.length === 0 ? MOCK_SESSIONS : parsed;
  } catch {
    return MOCK_SESSIONS;
  }
}

export default function App() {
  // Navigation & Screen Control
  const [isPlaying, setIsPlaying] = useState(false); // false = landing page, true = matching/chat workspace
  const [isMatching, setIsMatching] = useState(false); // loading screen spinner
  const [matchingStatus, setMatchingStatus] = useState("Looking for someone cool...");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Identity / Setup State
  const [nickname, setNickname] = useState(() => localStorage.getItem("neo_user_name") || "Anonymoid");
  const [targetUserId, setTargetUserId] = useState("");
  const [matchMode, setMatchMode] = useState(null); // 'peer' | 'ai' | null
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
  const [historySessions, setHistorySessions] = useState(loadHistorySessions);
  const [viewingPastSessionKey, setViewingPastSessionKey] = useState(null);

  // References
  const localVideoRef = useRef(null);
  const peerLandmarksRef = useRef(null);
  const messagesEndRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const lastLandmarkSendRef = useRef(0);
  const peerLandmarkStaleTimerRef = useRef(null);
  const sendPeerLandmarksRef = useRef(null);
  const [peerIsTracking, setPeerIsTracking] = useState(false);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const { landmarksRef, isTracking } = useHolisticFaceLandmarks(localVideoRef, cameraActive);

  const clearPeerLandmarks = useCallback(() => {
    peerLandmarksRef.current = null;
    setPeerIsTracking(false);
    if (peerLandmarkStaleTimerRef.current) {
      clearTimeout(peerLandmarkStaleTimerRef.current);
      peerLandmarkStaleTimerRef.current = null;
    }
  }, []);

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

  const lastConnectedRoomRef = useRef(null);
  const connectToPeerRef = useRef(null);
  const matchmakingActionsRef = useRef({
    sendMatchLeave: () => {},
    clearMatchedSession: () => {},
  });
  const stopGameRef = useRef(() => {});

  const connectToPeer = useCallback((peer) => {
    setViewingPastSessionKey(null);
    setIsPlaying(true);
    setIsMatching(false);
    setMatchMode('peer');
    setOpponentLeft(false);

    const peerProfile = {
      id: peer.id,
      alias: peer.nickname,
      nickname: peer.nickname,
      avatarColor: peer.avatarColor,
      interests: ['cham-cham-cham'],
      isPeerMatch: true,
    };

    setStranger(peerProfile);

    playSynthesizerBeep(523.25, 0.15, "sine");
    setTimeout(() => playSynthesizerBeep(659.25, 0.15, "sine"), 120);
    setTimeout(() => playSynthesizerBeep(783.99, 0.25, "sine"), 240);

    const systemWelcome = `Connected with ${peer.nickname} (${peer.id})!`;
    const initialLog = [
      {
        id: "sys-connect",
        role: "system",
        text: systemWelcome,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
    setChatLog(initialLog);

    const sessionKey = `session_${Date.now()}`;
    const newSession = {
      key: sessionKey,
      strangerAlias: peer.nickname,
      strangerAvatarColor: peer.avatarColor,
      interests: ['cham-cham-cham'],
      startTime: new Date().toLocaleString(),
      messages: initialLog,
    };
    setHistorySessions(prev => [newSession, ...prev]);
    setViewingPastSessionKey(sessionKey);
    startModelDownload();
    triggerToast(`Matched with ${peer.nickname}! Turn on camera so they can see you.`);
  }, [playSynthesizerBeep, triggerToast]);

  connectToPeerRef.current = connectToPeer;

  const matchmaking = useMatchmaking({
    nickname,
    onMatchIncoming: ({ fromNickname }) => {
      triggerToast(`${fromNickname} wants to play Cham Cham Cham!`);
      playSynthesizerBeep(880, 0.12, "triangle");
    },
    onMatchSent: ({ targetId }) => {
      triggerToast(`Challenge sent to ${targetId}! Waiting for them to accept...`);
    },
    onMatchError: (message) => {
      setIsMatching(false);
      setIsPlaying(false);
      lastConnectedRoomRef.current = null;
      triggerToast(message);
      playSynthesizerBeep(220, 0.2, "sawtooth");
    },
    onMatchDeclined: ({ by, reason }) => {
      setIsMatching(false);
      if (by === 'peer') {
        const msg = reason === 'disconnected'
          ? 'Your opponent disconnected.'
          : reason === 'cancelled'
            ? 'The challenge was cancelled.'
            : 'Your challenge was declined.';
        triggerToast(msg);

        if (reason === 'disconnected' && isPlaying && matchMode === 'peer') {
          setOpponentLeft(true);
          setStranger((prev) => (prev ? { ...prev, isPeerMatch: false } : null));
          clearPeerLandmarks();
          lastConnectedRoomRef.current = null;
          stopGameRef.current?.();
          matchmakingActionsRef.current.clearMatchedSession();
          matchmakingActionsRef.current.sendMatchLeave();
        } else if (isPlaying && matchMode === 'peer') {
          setIsPlaying(false);
          setStranger(null);
          setChatLog([]);
          clearPeerLandmarks();
          lastConnectedRoomRef.current = null;
          matchmakingActionsRef.current.clearMatchedSession();
        }
      }
      playSynthesizerBeep(220, 0.15, "sawtooth");
    },
    onPeerLandmarks: ({ landmarks }) => {
      const parsed = deserializeFaceLandmarks(landmarks);
      peerLandmarksRef.current = parsed;
      setPeerIsTracking(Boolean(parsed?.length));

      if (peerLandmarkStaleTimerRef.current) {
        clearTimeout(peerLandmarkStaleTimerRef.current);
      }
      peerLandmarkStaleTimerRef.current = setTimeout(() => {
        peerLandmarksRef.current = null;
        setPeerIsTracking(false);
      }, PEER_LANDMARK_STALE_MS);
    },
  });

  sendPeerLandmarksRef.current = matchmaking.sendPeerLandmarks;
  matchmakingActionsRef.current = {
    sendMatchLeave: matchmaking.sendMatchLeave,
    clearMatchedSession: matchmaking.clearMatchedSession,
  };
  stopGameRef.current = chamChamGame.stopGame;

  useEffect(() => {
    if (!matchmaking.matchedSession) return;
    if (lastConnectedRoomRef.current === matchmaking.matchedSession.roomId) return;

    lastConnectedRoomRef.current = matchmaking.matchedSession.roomId;
    connectToPeerRef.current?.(matchmaking.matchedSession.peer);
  }, [matchmaking.matchedSession]);

  useEffect(() => {
    if (!matchmaking.matchedSession || !cameraActive || !isPlaying) {
      return undefined;
    }

    let rafId;
    const tick = () => {
      const now = performance.now();
      if (now - lastLandmarkSendRef.current >= PEER_LANDMARK_SEND_INTERVAL_MS) {
        const serialized = serializeFaceLandmarks(landmarksRef.current);
        if (serialized) {
          const sent = sendPeerLandmarksRef.current?.(serialized);
          if (sent) {
            lastLandmarkSendRef.current = now;
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [matchmaking.matchedSession, cameraActive, isPlaying, landmarksRef]);

  // Setup Web Camera
  const toggleCamera = async () => {
    if (cameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      streamRef.current = null;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      setCameraActive(false);
      triggerToast("Webcam disabled");
    } else {
      // Kick off the GLB download now so it runs in parallel with camera permission + stream setup.
      startModelDownload();

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

  // Enter random AI matching mode
  const startRandomMatching = () => {
    setMatchMode('ai');
    setViewingPastSessionKey(null);
    setIsPlaying(true);
    setIsMatching(true);
    setStranger(null);
    setChatLog([]);
    playSynthesizerBeep(880, 0.1, "sine");

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

  const startPeerMatching = () => {
    const trimmedTargetId = targetUserId.trim();
    if (!trimmedTargetId) {
      triggerToast("Enter your friend's player ID first.");
      playSynthesizerBeep(220, 0.15, "sawtooth");
      return;
    }

    if (!matchmaking.isSocketConnected) {
      triggerToast("Matchmaking server is still connecting. Try again in a moment.");
      return;
    }

    setMatchMode('peer');
    setViewingPastSessionKey(null);
    setIsPlaying(true);
    setIsMatching(true);
    setStranger(null);
    setChatLog([]);
    setMatchingStatus(`Sending challenge to ${trimmedTargetId}...`);
    playSynthesizerBeep(880, 0.1, "sine");

    const sent = matchmaking.sendMatchRequest(trimmedTargetId);
    if (!sent) {
      setIsMatching(false);
      setIsPlaying(false);
    }
  };

  const cancelPeerMatching = () => {
    matchmaking.cancelWaiting();
    setIsMatching(false);
    setIsPlaying(false);
    setMatchMode(null);
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
    setMatchMode(null);
    setOpponentLeft(false);
    setStranger(null);
    lastConnectedRoomRef.current = null;
    matchmaking.sendMatchLeave();
    matchmaking.clearMatchedSession();
    clearPeerLandmarks();
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
    matchmaking.sendMatchLeave();
    lastConnectedRoomRef.current = null;
    matchmaking.clearMatchedSession();
    clearPeerLandmarks();
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

    if (stranger?.isPeerMatch) {
      if (viewingPastSessionKey) {
        setHistorySessions(prev => prev.map(s => {
          if (s.key === viewingPastSessionKey) {
            return { ...s, messages: newLogs };
          }
          return s;
        }));
      }
      return;
    }

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
      setHistorySessions(MOCK_SESSIONS);
      setViewingPastSessionKey(null);
      setStranger(null);
      setChatLog([]);
      triggerToast("All historical data purged successfully!");
      playSynthesizerBeep(180, 0.4, "sawtooth");
    }
  };

  const handleCopyUserId = async () => {
    const copied = await matchmaking.copyUserId();
    triggerToast(copied ? "Player ID copied to clipboard!" : "Could not copy player ID.");
    if (copied) playSynthesizerBeep(700, 0.08, "sine");
  };

  const handleAcceptInvite = () => {
    const invite = matchmaking.pendingInvite;
    if (!invite) return;

    setMatchMode('peer');
    setIsPlaying(true);
    setIsMatching(true);
    setMatchingStatus(`Accepting challenge from ${invite.fromNickname}...`);

    const accepted = matchmaking.acceptInvite(invite.inviteId);
    if (!accepted) {
      setIsMatching(false);
      setIsPlaying(false);
    }
  };

  const handleDeclineInvite = () => {
    if (!matchmaking.pendingInvite) return;
    matchmaking.declineInvite(matchmaking.pendingInvite.inviteId);
    triggerToast("Challenge declined.");
  };

  const toggleLandingCamera = async () => {
    await toggleCamera();
  };

  const isLandingTestCam = cameraActive && !isPlaying;

  return (
    <div className="neo-app">
      {/* Toast alert system widget */}
      {toastMessage && (
        <div className="neo-toast" id="system-toast">
          <Terminal size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {matchmaking.pendingInvite && (
        <div className="invite-overlay" id="incoming-invite-overlay">
          <div className="invite-banner invite-banner--modal">
            <p className="invite-banner-title">Incoming Challenge!</p>
            <p>
              <strong>{matchmaking.pendingInvite.fromNickname}</strong>
              {' '}({matchmaking.pendingInvite.fromId}) wants to play!
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap", marginTop: "1rem" }}>
              <button type="button" className="neo-btn neo-btn-sm neo-btn-green" onClick={handleAcceptInvite}>
                Accept
              </button>
              <button type="button" className="neo-btn neo-btn-sm" onClick={handleDeclineInvite}>
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Brand Header Bar */}
s

      {/* Main Container Area */}
      <div className="neo-main-content">
        {/* Dynamic Inner Viewport Area */}
        <div className="neo-view-viewport">
          {!isPlaying ? (
            /* ================= LANDING SCREEN ================= */
            <div className={`landing-page${isLandingTestCam ? ' landing-page--test-cam' : ''}`} id="landing-screen">
              <div className={`hero-card${isLandingTestCam ? ' hero-card--test-cam' : ''}`}>
                {isLandingTestCam ? (
                  <>
                    <h1 className="hero-title hero-title--compact">Test Cam</h1>
                    <p className="hero-subtitle hero-subtitle--compact">
                      Point your face at the camera for tracking. <br />
                      Adjusting seat to center your face. 
                    </p>

                    <div className="landing-camera-preview landing-camera-preview--compact" id="landing-camera-preview">
                      <div className="landing-camera-preview-label">
                        Camera preview ({nickname})
                      </div>
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ display: 'none' }}
                      />
                      <MediaPipeHolisticCanvas
                        videoRef={localVideoRef}
                        isActive={cameraActive}
                        label={nickname}
                        filterName={selectedFilter}
                        landmarksRef={landmarksRef}
                        isTracking={isTracking}
                        gameActive={false}
                        gameCue={null}
                        countdown={null}
                      />
                    </div>

                    <button
                      type="button"
                      className="neo-btn neo-btn-sm"
                      style={{ marginTop: "1.25rem" }}
                      onClick={toggleLandingCamera}
                      id="btn-back-to-home"
                      title="Turn off camera and return to home"
                    >
                      <Home size={16} />
                      Back to Home
                    </button>
                  </>
                ) : (
                  <>
                <h1 className="hero-title">
                  CHAM CHAM CHAM ONLINE
                </h1>
                
                <p className="hero-subtitle">
                  cham,,cham,,CHAM!
                </p>

                {/* Set user credential box */}
                <div className="setup-box" style={{ maxWidth: "500px", margin: "0 auto 2.5rem auto", width: "100%" }}>
                  <div style={{ marginBottom: "1rem" }}>
                    <label className="form-label" htmlFor="user-moniker">Nickname</label>
                    <input 
                      type="text" 
                      id="user-moniker"
                      className="form-input" 
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="e.g. Cham_Go_su"
                    />
                  </div>

                  <div style={{ marginBottom: "1rem" }}>
                    <label className="form-label" htmlFor="user-player-id">Your Player ID (auto-assigned)</label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <input
                        type="text"
                        id="user-player-id"
                        className="form-input"
                        value={matchmaking.userId || "Assigning..."}
                        readOnly
                      />
                      <button
                        type="button"
                        className="neo-btn neo-btn-sm neo-btn-cyan"
                        onClick={handleCopyUserId}
                        disabled={!matchmaking.userId}
                        title="Copy your player ID"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <p style={{ fontSize: "0.75rem", marginTop: "0.35rem", opacity: 0.75 }}>
                      Copy and share this ID. Type your friend&apos;s ID in the field below.
                      {matchmaking.isSocketConnected ? " Online." : " Connecting..."}
                    </p>
                  </div>

                  <div>
                    <label className="form-label" htmlFor="target-player-id">Friend&apos;s Player ID</label>
                    <input
                      type="text"
                      id="target-player-id"
                      className="form-input"
                      value={targetUserId}
                      onChange={(e) => setTargetUserId(e.target.value)}
                      placeholder="e.g. 42815"
                    />
                  </div>
                </div>

                {/* Action grid block buttons */}
                <div className="landing-actions" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center", alignItems: "center", width: "100%" }}>
                  <button 
                    className="neo-btn neo-btn-pink"
                    style={{ fontSize: "1.4rem", padding: "1rem 2.5rem" }}
                    onClick={startPeerMatching}
                    id="btn-start-match"
                  >
                    <UserPlus size={24} />
                    Challenge Friend
                  </button>


                </div>

                <div style={{ marginTop: "1rem", textAlign: "center" }}>
                  <button
                    type="button"
                    className="neo-btn neo-btn-sm"
                    style={{ marginRight: "1rem" }}
                    onClick={startRandomMatching}
                    id="btn-random-ai-match"
                  >
                    <Video size={16} />
                    Practice vs AI
                  </button>

                  <button
                    type="button"
                    className="neo-btn neo-btn-sm"
                    onClick={toggleLandingCamera}
                    id="btn-test-camera"
                    title="Test your webcam without starting a match"
                  >
                    <Camera size={16} />
                    Test Cam
                  </button>



                  {/* here */}
                </div>
                  </>
                )}

                
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
                    {matchMode === 'peer'
                      ? (matchmaking.waitingTargetId
                        ? `Waiting for ${matchmaking.waitingTargetId}...`
                        : matchingStatus)
                      : "Searching for a Match"}
                  </h3>

                  <p style={{ fontSize: "0.95rem", maxWidth: "420px", textAlign: "center", opacity: 0.85 }}>
                    {matchMode === 'peer'
                      ? "Your friend will see a popup invite. They must click Accept."
                      : matchingStatus}
                  </p>

                  <button 
                    className="neo-btn neo-btn-sm" 
                    style={{ marginTop: "2.5rem", backgroundColor: "var(--color-orange)", color: "white" }}
                    onClick={matchMode === 'peer' ? cancelPeerMatching : () => setIsPlaying(false)}
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
                <div className={`video-frame-container${opponentLeft ? ' video-frame-container--solo' : ''}`}>
                  {/* Visual frame 1: YOU */}
                  <div className="video-frame">
                    <div className="video-label-tag">
                      You ({nickname})
                    </div>

                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ display: 'none' }}
                    />

                    <MediaPipeHolisticCanvas
                      videoRef={localVideoRef}
                      isActive={cameraActive}
                      label={nickname}
                      filterName={selectedFilter}
                      landmarksRef={landmarksRef}
                      isTracking={isTracking}
                      gameActive={chamChamGame.gameActive}
                      gameCue={chamChamGame.gameCue}
                      countdown={chamChamGame.countdown}
                    />
                  </div>
                  
                  {!opponentLeft && (
                  <div className="video-frame">
                    <div className="video-label-tag video-label-tag-pink">
                      {stranger?.isPeerMatch
                        ? `${stranger.nickname || stranger.alias} (remote)`
                        : 'Opponent'}
                    </div>

                    {stranger?.isPeerMatch ? (
                      <MediaPipeHolisticCanvas
                        isActive
                        label={stranger.nickname || stranger.alias || 'Opponent'}
                        landmarksRef={peerLandmarksRef}
                        isTracking={peerIsTracking}
                        gameActive={false}
                        gameCue={null}
                        countdown={null}
                        remoteView
                      />
                    ) : (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#FF85B3',
                          border: '3px solid #000',
                          boxSizing: 'border-box',
                          padding: '1.5rem',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8rem' }}>
                          Challenge a friend to see their 3D face model here
                        </div>
                      </div>
                    )}
                  </div>
                  )}

                </div>

                {/* Dynamic Action row under visual feed */}
                <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                  {opponentLeft && (
                    <span
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}
                    >
                      Opponent left
                    </span>
                  )}

                  {chamChamGame.showScore && (
                    <div className={`game-score-display ${chamChamGame.gamePhase === 'gameOver' ? 'game-score-display--over' : ''}`}>
                      Score: {chamChamGame.score}
                      {chamChamGame.gamePhase === 'gameOver' ? ' · Game Over' : ''}
                    </div>
                  )}

                  {!opponentLeft && (
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
                  )}

                  <button
                    type="button"
                    className={`neo-btn neo-btn-sm${opponentLeft ? ' neo-btn-green' : ''}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      padding: opponentLeft ? "0.75rem 1.25rem" : "0.6rem 1rem",
                    }}
                    onClick={quitToLanding}
                    title="Leave match and return to landing page"
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
            {historySessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 1rem', fontStyle: 'italic', fontSize: '0.8rem', color: '#666' }}>
                No automated saved archives found. Connect and exchange details to log a session.
              </div>
            ) : (
              historySessions.map((session) => {
                const isActive = viewingPastSessionKey === session.key;
                const textMsgs = session.messages.filter((m) => m.role === 'user' || m.role === 'stranger');
                const lastSnippet = textMsgs.length > 0 ? textMsgs[textMsgs.length - 1].text : 'No messages saved';

                return (
                  <div
                    key={session.key}
                    className={`past-session-item ${isActive ? 'active' : ''}`}
                    style={{ borderLeft: `6px solid ${session.strangerAvatarColor}` }}
                    onClick={() => selectPastSession(session)}
                  >
                    <div className="past-session-topic">
                      <span style={{ fontWeight: '700' }}>{session.strangerAlias}</span>
                      <button
                        type="button"
                        className="neo-btn neo-btn-sm"
                        style={{ border: '2px solid #000', padding: '0.15rem', boxShadow: 'none' }}
                        onClick={(e) => deleteHistorySession(session.key, e)}
                        title="Delete archive"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="past-session-date">{session.startTime}</div>
                    <div className="past-session-snippet">{lastSnippet}</div>
                  </div>
                );
              })
            )}
          </div>

          <div className="sidebar-footer-clearing">
            <button
              type="button"
              className="neo-btn neo-btn-sm"
              style={{ width: '100%' }}
              onClick={clearAllHistory}
            >
              <Trash2 size={14} />
              <span>Reset to demo archives</span>
            </button>
          </div>

        </aside>
      </div>

      {/* Persistent Outer Footer */}
    </div>
  );
}