import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';
import { 
  ChefHat, Mic, BookOpen, User, Save, Share2, Printer, 
  Volume2, VolumeX, ShoppingBag, Leaf, Flame, Loader2, ArrowLeft, Trash2, LogOut, Clock,
  Camera, X, Maximize, ChevronRight, ChevronLeft, Wand2, Send, Globe,
  Timer, Play, Pause, RotateCcw, Calendar, MessageCircle, Music, Search, Heart, Sparkles, Utensils, RefreshCw, Users, Link2 as LinkIcon,
  SkipBack, SkipForward
} from 'lucide-react';

// --- Smart Image Generators & Fallbacks (100% Hit Rate) ---
const getFallbackChain = (ingredient) => {
  // Use base_name if backend provided it, otherwise use raw name, fallback to 'food'
  const rawName = ingredient?.base_name || ingredient?.name || (typeof ingredient === 'string' ? ingredient : 'food');
  let text = String(rawName).toLowerCase();
  
  text = text.replace(/\(.*?\)/g, ''); // Remove parentheses

  // 1. Aggressive prep-word and measurement removal
  const wordsToRemove = [
    /\bboneless\b/gi, /\bskinless\b/gi, /\bfull-fat\b/gi, /\blow-fat\b/gi,
    /\blarge\b/gi, /\bsmall\b/gi, /\bmedium\b/gi, /\bsliced\b/gi, /\bdiced\b/gi,
    /\bfresh\b/gi, /\braw\b/gi, /\bchopped\b/gi, /\bminced\b/gi, /\bcrushed\b/gi,
    /\bpieces\b/gi, /\bcut\b/gi, /\binto\b/gi, /\bbite-sized\b/gi, /\bpeeled\b/gi, /\bgrated\b/gi,
    /\bhalved\b/gi, /\bquartered\b/gi, /\bto taste\b/gi, /\bapproximately\b/gi,
    /[0-9\.\/]+(g|ml|kg|l|oz|lb|cups?|tablespoons?|tbsps?|teaspoons?|tsps?|cans?|cloves?|whole|half|quarter|pinch|dash)\b/gi
  ];

  wordsToRemove.forEach(pattern => {
    text = text.replace(pattern, ' ');
  });

  // Clean up punctuation and double spaces
  text = text.replace(/[,.-]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text.split(' ').filter(Boolean);
  
  if (words.length === 0) words.push('food');

  const spoonacularBase = words.join('-');
  const mealDbBase = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('%20');
  
  // Dynamic Web Search Query for guaranteed 100% fallback
  const bingQuery = encodeURIComponent(words.join(' ') + ' raw ingredient food white background');

  // Known strict dictionary overrides for Spoonacular
  const dictionary = {
    'chicken-breast': 'chicken-breasts',
    'thai-green-curry-paste': 'green-curry-paste',
    'fish-sauce': 'asian-fish-sauce',
    'brown-sugar': 'dark-brown-sugar',
    'red-bell-pepper': 'red-pepper',
    'bell-pepper': 'red-pepper',
    'garlic-cloves': 'garlic',
    'garlic-clove': 'garlic',
    'cilantro-leaves': 'cilantro'
  };

  const attempts = new Set();
  
  // ATTEMPT 1: Spoonacular CDN (Exact + Dictionary + Plural checks)
  if (dictionary[spoonacularBase]) attempts.add(`https://spoonacular.com/cdn/ingredients_100x100/${dictionary[spoonacularBase]}.jpg`);
  attempts.add(`https://spoonacular.com/cdn/ingredients_100x100/${spoonacularBase}.jpg`);
  if (!spoonacularBase.endsWith('s')) attempts.add(`https://spoonacular.com/cdn/ingredients_100x100/${spoonacularBase}s.jpg`);
  else attempts.add(`https://spoonacular.com/cdn/ingredients_100x100/${spoonacularBase.slice(0, -1)}.jpg`);
  
  // ATTEMPT 2: TheMealDB CDN Fallback
  attempts.add(`https://www.themealdb.com/images/ingredients/${mealDbBase}-Small.png`);

  // ATTEMPT 3: 100% GUARANTEED FALLBACK - Bing Public Image Cache
  // This will dynamically fetch a 128x128 thumbnail of literally any string passed to it.
  attempts.add(`https://tse2.mm.bing.net/th?q=${bingQuery}&w=128&h=128&c=7&rs=1&p=0&dpr=3&pid=1.7`);

  return Array.from(attempts);
};

const getFallbackLetter = (ingredientName) => {
  const cleanFirstChar = String(ingredientName || 'F').replace(/^[\d\W]+/, '');
  return cleanFirstChar ? cleanFirstChar[0].toUpperCase() : 'F';
};

// --- Dedicated React Component for Smart Image Cycling ---
const IngredientIcon = ({ ingredient }) => {
  // Compute fallback chain once per ingredient
  const urls = useMemo(() => getFallbackChain(ingredient), [ingredient]);
  const [index, setIndex] = useState(0);

  const handleError = () => {
    // Instantly cycle to the next probable filename/API if the current one 404s
    if (index < urls.length - 1) {
      setIndex(index + 1);
    } else {
      setIndex(-1); // Safety letter fallback (almost impossible to hit with Bing added)
    }
  };

  if (index === -1) {
    const rawName = ingredient?.base_name || ingredient?.name;
    const letter = getFallbackLetter(rawName);
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#FAF8F3] text-[#8C7E71] font-serif text-2xl font-black">
        {letter}
      </div>
    );
  }

  return (
    <img 
      src={urls[index]} 
      alt={ingredient?.name || 'ingredient'}
      className="w-full h-full object-contain mix-blend-multiply transition-opacity duration-300"
      onError={handleError}
    />
  );
};


// --- Firebase Initialization ---
const firebaseConfig = {
  authDomain: "ai-chef-41737.firebaseapp.com",
  projectId: "ai-chef-41737",
  storageBucket: "ai-chef-41737.firebasestorage.app",
  messagingSenderId: "98469212121",
  appId: "1:98469212121:web:1332df2c19da4fac1733c8",
  measurementId: "G-260NRYTWVW"
};

let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.warn("Firebase not configured yet. Saving features will be disabled.");
}

// --- Backend Configuration ---
const BACKEND_URL = "https://ai-chef-backend-cmye.onrender.com"; 

// --- Spotify PKCE Helper Functions ---
const generateRandomString = (length) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Object.values(values).reduce((acc, x) => acc + possible[x % possible.length], "");
};

const sha256 = async (plain) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
};

const base64encode = (input) => {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

// --- Helper Components & Constants ---
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEALS = ['Breakfast', 'Lunch', 'Dinner'];

const QuickBadge = ({ icon, text, bgColor = "bg-[#F3EFE8]", textColor = "text-[#5C5449]" }) => (
  <div className={`flex items-center space-x-1.5 ${bgColor} ${textColor} px-3.5 py-2 rounded-xl text-sm font-semibold tracking-wide border border-[#E8E4DB]`}>
    {icon}
    <span>{text}</span>
  </div>
);

const NutritionPill = ({ label, value }) => (
  <div className="flex flex-col items-center justify-center bg-[#FAF8F3] border border-[#E8E4DB] rounded-2xl p-4 shadow-sm flex-1 min-w-[70px] hover:shadow-md transition-shadow">
    <span className="text-xl font-black text-[#2C2825] font-serif">{typeof value === 'object' && value !== null ? JSON.stringify(value) : (value ?? '0')}</span>
    <span className="text-[11px] text-[#8C7E71] font-bold uppercase tracking-widest mt-1">{label}</span>
  </div>
);

// --- Math Helpers for Dynamic Portion Scaling ---
const parseFraction = (str) => {
  const parts = str.trim().split(/\s+/);
  let value = 0;
  parts.forEach(part => {
    if (part.includes('/')) {
      const [n, d] = part.split('/');
      if (parseFloat(d) !== 0) value += (parseFloat(n) / parseFloat(d));
    } else {
      value += parseFloat(part);
    }
  });
  return value;
};

const scaleQuantity = (quantityStr, multiplier) => {
  if (!quantityStr) return '';
  if (multiplier === 1) return String(quantityStr);
  
  const match = String(quantityStr).match(/^([\d\s\.\/]+)(.*)$/);
  if (!match || !match[1].trim()) return String(quantityStr);

  const numStr = match[1].trim();
  const unit = match[2];

  const parsedNum = parseFraction(numStr);
  if (isNaN(parsedNum) || parsedNum === 0) return String(quantityStr); 

  const scaled = parsedNum * multiplier;
  let formattedScaled = parseFloat(scaled.toFixed(2)).toString();
  
  return `${formattedScaled}${unit}`; 
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  const [profileData, setProfileData] = useState({ age: '', nationality: '', preferences: '' });
  
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [communityRecipes, setCommunityRecipes] = useState([]); 
  
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('Crafting Recipe...');
  const [currentRecipe, setCurrentRecipe] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState(''); 
  
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // --- URL Detection State ---
  const [detectedLink, setDetectedLink] = useState(null);

  useEffect(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const match = prompt.match(urlRegex);
    if (match) {
      try {
        const urlObj = new URL(match[0]);
        setDetectedLink({ full: match[0], hostname: urlObj.hostname.replace('www.', '') });
      } catch (e) {
        setDetectedLink(null);
      }
    } else {
      setDetectedLink(null);
    }
  }, [prompt]);

  // --- Portion Slider State ---
  const [portionMultiplier, setPortionMultiplier] = useState(1);

  useEffect(() => {
    setPortionMultiplier(1);
  }, [currentRecipe?.title]);

  // --- Meal Planner State ---
  const initialMealPlan = DAYS.reduce((acc, day) => {
    acc[day] = { Breakfast: null, Lunch: null, Dinner: null };
    return acc;
  }, {});
  const [mealPlan, setMealPlan] = useState(initialMealPlan);

  // --- Tweak Recipe State ---
  const [tweakPrompt, setTweakPrompt] = useState('');
  const [isTweaking, setIsTweaking] = useState(false);

  // --- Floating Sous-Chef State ---
  const [isSousChefOpen, setIsSousChefOpen] = useState(false);
  const [sousChefMessages, setSousChefMessages] = useState([]);
  const [sousChefInput, setSousChefInput] = useState('');
  const [isSousChefTyping, setIsSousChefTyping] = useState(false);
  const chatEndRef = useRef(null);

  // --- Kitchen Mode State ---
  const [isKitchenMode, setIsKitchenMode] = useState(false);
  const [kitchenStep, setKitchenStep] = useState(0);
  const [isKitchenListening, setIsKitchenListening] = useState(false);
  
  // --- Smart Timer State ---
  const [detectedTime, setDetectedTime] = useState(null);
  const [initialTimerSeconds, setInitialTimerSeconds] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const kitchenStepRef = useRef(0);
  const kitchenScrollRef = useRef(null); 

  // --- Dynamic Inspiration State (The Idea Queue) ---
  const [inspirationChips, setInspirationChips] = useState(() => {
    try {
      const queue = JSON.parse(window.localStorage.getItem('idea_queue') || '[]');
      if (queue.length >= 3) return queue.slice(0, 3);
    } catch(e) {}
    return []; 
  });
  const [isLoadingIdeas, setIsLoadingIdeas] = useState(inspirationChips.length === 0);
  const hasFetchedIdeas = useRef(false);

  useEffect(() => {
    try {
      const queue = JSON.parse(window.localStorage.getItem('idea_queue') || '[]');
      if (queue.length >= 3 && inspirationChips.length > 0) {
         window.localStorage.setItem('idea_queue', JSON.stringify(queue.slice(3)));
      }
    } catch(e) {}
  }, []);

  // --- Spotify Integration State ---
  const SPOTIFY_CLIENT_ID = "3fdacf51298c466ba6974fb0cc7a5425"; 
  const [spotifyToken, setSpotifyToken] = useState(window.localStorage.getItem('spotify_token') || '');
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [activeSpotifyUri, setActiveSpotifyUri] = useState(''); 
  const [isSpotifyOpen, setIsSpotifyOpen] = useState(false);

  const [spotifyView, setSpotifyView] = useState('library'); 
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSpotifyLoading, setIsSpotifyLoading] = useState(false);
  const [viewingPlaylistUri, setViewingPlaylistUri] = useState(null);

  // --- Track Navigation Helpers ---
  const handlePrevTrack = () => {
    // Find whether the active track is from the playlist view or search results
    const list = playlistTracks.some(t => t.uri === activeSpotifyUri) ? playlistTracks : searchResults;
    const idx = list.findIndex(t => t.uri === activeSpotifyUri);
    if (idx > 0) {
      setActiveSpotifyUri(list[idx - 1].uri);
    }
  };

  const handleNextTrack = () => {
    const list = playlistTracks.some(t => t.uri === activeSpotifyUri) ? playlistTracks : searchResults;
    const idx = list.findIndex(t => t.uri === activeSpotifyUri);
    if (idx !== -1 && idx < list.length - 1) {
      setActiveSpotifyUri(list[idx + 1].uri);
    }
  };

  // --- Dynamic Title & Favicon ---
  useEffect(() => {
    document.title = "Sauté Bot";
    const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <rect width="24" height="24" rx="6" fill="#C2410C"/>
      <path d="M17 8a4.5 4.5 0 0 0-8.62-1.5A3.5 3.5 0 0 0 5.5 10 3.5 3.5 0 0 0 8 13.42V15a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1.58A3.5 3.5 0 0 0 18.5 10 3.5 3.5 0 0 0 17 8z" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8 18h8" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = `data:image/svg+xml,${encodeURIComponent(faviconSvg)}`;
  }, []);
  
  useEffect(() => {
    kitchenStepRef.current = kitchenStep;
  }, [kitchenStep]);

  // --- Spotify PKCE Auth Callback ---
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    const errorStr = searchParams.get('error');

    if (errorStr) {
      setErrorMsg(`Spotify Auth Error: ${errorStr}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (code) {
      const codeVerifier = window.localStorage.getItem('code_verifier');
      const redirectUri = window.location.origin.replace('localhost', '127.0.0.1') + '/';

      const payload = {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }),
      };

      fetch('https://accounts.spotify.com/api/token', payload)
        .then(res => res.json())
        .then(data => {
           if(data.access_token) {
             window.localStorage.setItem('spotify_token', data.access_token);
             setSpotifyToken(data.access_token);
             setIsSpotifyOpen(true);
             setSpotifyView('library');
           } else if (data.error) {
             setErrorMsg(`Spotify Auth Error: ${data.error_description || data.error}`);
           }
           window.history.replaceState({}, document.title, window.location.pathname);

           const savedRecipe = window.localStorage.getItem('spotify_return_recipe');
           if (savedRecipe) {
             try {
               setCurrentRecipe(JSON.parse(savedRecipe));
               const savedView = window.localStorage.getItem('spotify_return_view');
               if (savedView) setView(savedView);
               const savedKitchenMode = window.localStorage.getItem('spotify_return_kitchen_mode');
               if (savedKitchenMode === 'true') {
                 setIsKitchenMode(true);
                 setIsSpotifyOpen(true);
               }
               const savedStep = window.localStorage.getItem('spotify_return_kitchen_step');
               if (savedStep) setKitchenStep(parseInt(savedStep, 10));
             } catch (e) {
               console.error("Error restoring state", e);
             } finally {
               window.localStorage.removeItem('spotify_return_recipe');
               window.localStorage.removeItem('spotify_return_view');
               window.localStorage.removeItem('spotify_return_kitchen_mode');
               window.localStorage.removeItem('spotify_return_kitchen_step');
               window.localStorage.removeItem('code_verifier');
             }
           }
        })
        .catch(err => {
          setErrorMsg("Failed to connect to Spotify.");
        });
    }
  }, []);

  useEffect(() => {
    if (spotifyToken && spotifyView === 'library') {
      fetch('https://api.spotify.com/v1/me/playlists', {
        headers: { Authorization: `Bearer ${spotifyToken}` }
      })
      .then(res => {
        if (res.status === 401) {
          window.localStorage.removeItem('spotify_token');
          setSpotifyToken('');
          return { items: [] };
        }
        return res.json();
      })
      .then(data => {
        if (data.items) setSpotifyPlaylists(data.items);
      })
      .catch(err => console.error("Spotify fetch error", err));
    }
  }, [spotifyToken, spotifyView]);

  const handleSpotifyLogin = async () => {
    if (SPOTIFY_CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
      alert("Please add your Spotify Client ID to the code!");
      return;
    }

    const codeVerifier = generateRandomString(64);
    window.localStorage.setItem('code_verifier', codeVerifier);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64encode(hashed);

    if (currentRecipe) {
      window.localStorage.setItem('spotify_return_recipe', JSON.stringify(currentRecipe));
      window.localStorage.setItem('spotify_return_view', view);
      window.localStorage.setItem('spotify_return_kitchen_mode', isKitchenMode.toString());
      window.localStorage.setItem('spotify_return_kitchen_step', kitchenStep.toString());
    }

    const redirectUri = window.location.origin.replace('localhost', '127.0.0.1') + '/';
    const scopes = ['playlist-read-private', 'playlist-read-collaborative', 'user-library-read'];
    
    const authUrl = new URL("https://accounts.spotify.com/authorize");
    const params = {
      response_type: 'code',
      client_id: SPOTIFY_CLIENT_ID,
      scope: scopes.join(' '),
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      redirect_uri: redirectUri,
    }
    authUrl.search = new URLSearchParams(params).toString();
    window.location.href = authUrl.toString();
  };

  const handleSpotifyLogout = () => {
    window.localStorage.removeItem('spotify_token');
    setSpotifyToken('');
    setSpotifyPlaylists([]);
    setSpotifyView('library');
    setActiveSpotifyUri('');
  };

  const fetchSpotifyTracks = async (type, id = null, uri = null) => {
    setIsSpotifyLoading(true);
    setSpotifyView('playlist');
    setPlaylistTracks([]);
    setViewingPlaylistUri(uri);

    try {
      let url = type === 'liked' 
        ? 'https://api.spotify.com/v1/me/tracks?limit=50'
        : `https://api.spotify.com/v1/playlists/${id}/tracks?limit=50`;
        
      const res = await fetch(url, { headers: { Authorization: `Bearer ${spotifyToken}` } });
      const data = await res.json();
      setPlaylistTracks(data.items ? data.items.map(item => item.track).filter(t => t && t.id) : []);
    } catch (err) {
      console.error("Error fetching tracks", err);
    } finally {
      setIsSpotifyLoading(false);
    }
  };

  const handleSpotifySearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSpotifyLoading(true);
    setSpotifyView('search');
    try {
      const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=30`, {
        headers: { Authorization: `Bearer ${spotifyToken}` }
      });
      const data = await res.json();
      setSearchResults(data.tracks?.items || []);
    } catch (err) {
      console.error("Spotify search error", err);
    } finally {
      setIsSpotifyLoading(false);
    }
  };

  const getSpotifyEmbedUrl = (uri) => {
    if (!uri) return '';
    const parts = uri.split(':');
    if (parts.length >= 3) {
      const type = parts[parts.length - 2];
      const id = parts[parts.length - 1];
      return `https://open.spotify.com/embed/${type}/${id}?theme=0`;
    }
    return '';
  };

  useEffect(() => {
    setSousChefMessages([]);
    setIsSousChefOpen(false);
    setSousChefInput('');
  }, [currentRecipe?.title]);
  
  useEffect(() => {
    if (isSousChefOpen) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sousChefMessages, isSousChefTyping, isSousChefOpen]);

  // --- Snap & Cook State ---
  const [selectedImage, setSelectedImage] = useState(null);
  const fileInputRef = useRef(null);

  // --- Auth State ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginView, setIsLoginView] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  const recognitionRef = useRef(null);
  const micTimeoutRef = useRef(null); 

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && !recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
    }

    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
      });
      return () => unsubscribe();
    }
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setErrorMsg('');
    try {
      if (isLoginView) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setEmail('');
      setPassword('');
    } catch (err) {
      setErrorMsg(err.message.replace('Firebase: ', ''));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      setView('home');
    }
  };

  // --- Data Fetching ---
  useEffect(() => {
    if (!user || !db) return;

    const profileRef = doc(db, 'users', user.uid, 'settings', 'profile');
    getDoc(profileRef).then((docSnap) => {
      if (docSnap.exists()) setProfileData(docSnap.data());
    });

    const planRef = doc(db, 'users', user.uid, 'settings', 'mealPlan');
    getDoc(planRef).then((docSnap) => {
      if (docSnap.exists()) setMealPlan({ ...initialMealPlan, ...docSnap.data() });
    });

    const recipesRef = collection(db, 'users', user.uid, 'recipes');
    const unsubscribeRecipes = onSnapshot(recipesRef, (snapshot) => {
      const recipes = [];
      snapshot.forEach((doc) => recipes.push({ id: doc.id, ...doc.data() }));
      recipes.sort((a,b) => new Date(b.savedAt) - new Date(a.savedAt));
      setSavedRecipes(recipes);
    });

    const communityRef = collection(db, 'communityRecipes');
    const unsubscribeCommunity = onSnapshot(communityRef, (snapshot) => {
      const recipes = [];
      snapshot.forEach((doc) => recipes.push({ id: doc.id, ...doc.data() }));
      recipes.sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      setCommunityRecipes(recipes);
    });

    return () => {
      unsubscribeRecipes();
      unsubscribeCommunity();
    };
  }, [user]);

  // --- Fetch Dynamic Ideas (Background Refill) ---
  const fetchDynamicIdeas = async () => {
    if (inspirationChips.length === 0) setIsLoadingIdeas(true);
    try {
      const historyTitles = savedRecipes.slice(0, 5).map(r => r.title);
      const prevSuggestions = JSON.parse(window.localStorage.getItem('prev_suggestions') || '[]');

      const response = await fetch(`${BACKEND_URL}/api/ideas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age: profileData.age || '',
          nationality: profileData.nationality || '',
          preferences: profileData.preferences || '',
          history: historyTitles,
          previous_suggestions: prevSuggestions
        })
      });
      
      if (response.ok) {
        const newIdeas = await response.json();
        if (Array.isArray(newIdeas) && newIdeas.length > 0) {
          let currentQueue = JSON.parse(window.localStorage.getItem('idea_queue') || '[]');
          currentQueue = [...currentQueue, ...newIdeas];
          
          setInspirationChips(prev => {
            if (prev.length === 0) {
               // If the screen was empty, instantly show 3 and save the rest
               const immediateChips = currentQueue.slice(0, 3);
               window.localStorage.setItem('idea_queue', JSON.stringify(currentQueue.slice(3)));
               setIsLoadingIdeas(false);
               return immediateChips;
            }
            // Otherwise, just refill the background queue silently
            window.localStorage.setItem('idea_queue', JSON.stringify(currentQueue));
            return prev;
          });

          // Track to avoid showing same ideas next time
          const updatedPrev = [...prevSuggestions, ...newIdeas].slice(-15);
          window.localStorage.setItem('prev_suggestions', JSON.stringify(updatedPrev));
        }
      }
    } catch (e) {
      console.error("Failed to fetch ideas", e);
      setIsLoadingIdeas(false);
    }
  };

  // Silently refill the queue in the background if it gets low
  useEffect(() => {
    if (user && !hasFetchedIdeas.current && view === 'home') {
      const timer = setTimeout(() => {
        const queue = JSON.parse(window.localStorage.getItem('idea_queue') || '[]');
        if (queue.length < 6) {
          fetchDynamicIdeas();
        }
        hasFetchedIdeas.current = true;
      }, 500); 
      return () => clearTimeout(timer);
    }
  }, [user, profileData, savedRecipes, view]);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500); 
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!user || !db) return setErrorMsg("Firebase is not configured. Cannot save profile.");
    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'profile'), profileData);
      showSuccess("Profile saved successfully!");
      setView('home');
    } catch (err) {
      setErrorMsg("Failed to save profile.");
    }
  };

  const updateMealPlan = async (newPlan) => {
    setMealPlan(newPlan);
    if (!user || !db) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'mealPlan'), newPlan);
    } catch (err) {
      setErrorMsg("Failed to sync meal plan.");
    }
  };

  const handleDragStart = (e, recipe) => e.dataTransfer.setData('recipeId', recipe.id);

  const handleDrop = (e, day, meal) => {
    e.preventDefault();
    const recipeId = e.dataTransfer.getData('recipeId');
    const draggedRecipe = savedRecipes.find(r => r.id === recipeId);
    
    if (draggedRecipe) {
      updateMealPlan({ ...mealPlan, [day]: { ...mealPlan[day], [meal]: draggedRecipe } });
      showSuccess(`Added to ${day} ${meal}`);
    }
  };

  const handleRemoveMeal = (day, meal) => {
    updateMealPlan({ ...mealPlan, [day]: { ...mealPlan[day], [meal]: null } });
  };

  // --- AI Recipe Generation ---
  const generateRecipe = async () => {
    if (!prompt.trim() && !selectedImage) return;
    setIsGenerating(true);
    setErrorMsg('');
    setCurrentRecipe(null);
    setView('recipe');
    setGenerationStep('Warming up the kitchen...');

    try {
      let finalPrompt = prompt || "Please analyze these ingredients and create a delicious recipe using them.";

      // --- 🚀 NEW: Frontend Social Media Extractor ---
      // Instagram blocks server IPs. We bypass this by having the frontend 
      // ping a public metadata API to grab the caption *before* sending it to Gemini!
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = finalPrompt.match(urlRegex);

      if (urls) {
        setGenerationStep('Extracting video recipe...');
        for (const url of urls) {
          if (url.includes('instagram.com') || url.includes('tiktok.com')) {
            try {
              const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
              const data = await res.json();
              if (data.status === 'success' && data.data) {
                const caption = data.data.description || data.data.title || '';
                if (caption) {
                  finalPrompt += `\n\n[SYSTEM NOTE: The user pasted a social media video link. I have successfully bypassed the firewall and extracted the caption/text for you: "${caption}". DO NOT attempt to browse or access the URL yourself. DO NOT say you cannot access external links. Just use this extracted text to figure out the exact recipe.]`;
                }
              }
            } catch (e) {
              console.warn("Metadata extraction failed", e);
            }
          }
        }
      }

      setGenerationStep('Crafting your dish...');

      const enhancedPrompt = `${finalPrompt}\n\nIMPORTANT: You MUST calculate and include realistic numerical values for 'totalNutrition' (calories, protein, carbs, fat) for the overall recipe, and 'nutrition' for each individual ingredient. Do not leave them empty or 0. DO NOT refuse to generate a recipe.`;

      const payload = { prompt: enhancedPrompt, age: profileData.age, nationality: profileData.nationality, preferences: profileData.preferences };
      if (selectedImage) payload.image = selectedImage;

      const response = await fetch(`${BACKEND_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errText = await response.text();
        try { errText = JSON.parse(errText).detail || errText; } catch(e) {}
        throw new Error(errText || `Server returned ${response.status}`);
      }
      
      setCurrentRecipe(await response.json());
      setPrompt('');
      setSelectedImage(null);
    } catch (err) {
      console.error("AI Generation Error:", err);
      if (err.message === "Failed to fetch") {
        setErrorMsg(`Network Error: The backend is asleep or offline. Please wait 60 seconds and try again!`);
      } else {
        setErrorMsg(`Generation Error: ${err.message}`);
      }
      setView('home');
    } finally {
      setIsGenerating(false);
    }
  };

  const tweakRecipe = async () => {
    if (!tweakPrompt.trim() || !currentRecipe) return;
    setIsTweaking(true);
    setErrorMsg('');

    try {
      const combinedPrompt = `I have the following recipe:\n\nTitle: ${currentRecipe.title}\nIngredients: ${JSON.stringify(currentRecipe.ingredients)}\nInstructions: ${JSON.stringify(currentRecipe.instructions)}\n\nPlease modify and recreate this recipe based on the following request: "${tweakPrompt}".\n\nIMPORTANT: Ensure the entire recipe is returned in the standard JSON structure. You MUST calculate and update accurate numerical values for 'totalNutrition' (calories, protein, carbs, fat) and the 'nutrition' for each individual ingredient based on the tweaks made. Do not return 0.`;

      const response = await fetch(`${BACKEND_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: combinedPrompt, age: profileData.age, nationality: profileData.nationality, preferences: profileData.preferences })
      });

      if (!response.ok) {
        let errText = await response.text();
        try { errText = JSON.parse(errText).detail || errText; } catch(e) {}
        throw new Error(errText);
      }
      
      setCurrentRecipe(await response.json());
      setTweakPrompt('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErrorMsg(`Tweak Error: ${err.message}`);
    } finally {
      setIsTweaking(false);
    }
  };

  const handleSendSousChefMessage = async () => {
    if (!sousChefInput.trim() || !currentRecipe) return;
    
    const userText = sousChefInput.trim();
    setSousChefMessages(prev => [...prev, { role: 'user', text: userText }]);
    setSousChefInput('');
    setIsSousChefTyping(true);
    
    try {
      const chatPrompt = `You are a helpful AI Sous-Chef assisting a user who is currently cooking: "${currentRecipe.title}".
      Context: Ingredients: ${JSON.stringify((currentRecipe.ingredients || []).map(i => i.name))}, Instructions: ${JSON.stringify(currentRecipe.instructions)}
      The user asks: "${userText}"
      Answer their question clearly, concisely, and directly. 
      IMPORTANT: Because of our API structure, you MUST return a valid JSON object matching the recipe schema. 
      Place your ENTIRE answer inside the "description" field. Fill the rest with EXACT minimal dummy values.
      "title": "Chef Answer", "prepTime": "0 mins", "ingredients": [{"name": "none", "quantity": "0", "nutrition": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}}], "instructions": ["See description for answer."], "totalNutrition": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}`;

      const response = await fetch(`${BACKEND_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: chatPrompt, age: profileData.age, nationality: profileData.nationality, preferences: profileData.preferences })
      });

      if (!response.ok) throw new Error(`API Error`);
      const data = await response.json();
      setSousChefMessages(prev => [...prev, { role: 'assistant', text: data.description || "I'm not exactly sure, but keep cooking!" }]);
    } catch (error) {
      setSousChefMessages(prev => [...prev, { role: 'assistant', text: "Sorry, my connection to the kitchen is a bit fuzzy right now." }]);
    } finally {
      setIsSousChefTyping(false);
    }
  };

  const saveRecipeToDB = async () => {
    if (!user || !currentRecipe || !db) return setErrorMsg("Cannot save recipe.");
    try {
      const { id, ...recipeData } = currentRecipe; 
      await addDoc(collection(db, 'users', user.uid, 'recipes'), { ...recipeData, savedAt: new Date().toISOString() });
      showSuccess("Recipe saved to your Cookbook!");
      setView('saved');
    } catch (err) {
      setErrorMsg("Failed to save recipe.");
    }
  };

  const publishToCommunity = async () => {
    if (!user || !currentRecipe || !db) return;
    try {
      const { id, ...recipeData } = currentRecipe;
      await addDoc(collection(db, 'communityRecipes'), {
        ...recipeData, publishedBy: user.email?.split('@')[0] || 'Anonymous Chef', publisherUid: user.uid, publishedAt: new Date().toISOString()
      });
      showSuccess("Recipe published to Community!");
    } catch (err) {
      setErrorMsg("Failed to publish recipe.");
    }
  };

  const deleteRecipe = async (id) => {
    if (!user || !db) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'recipes', id));
      showSuccess("Recipe deleted.");
    } catch (err) {
      setErrorMsg("Failed to delete recipe.");
    }
  };

  const deleteCommunityRecipe = async (id, publisherUid) => {
    if (!user || !db || user.uid !== publisherUid) return;
    try {
      await deleteDoc(doc(db, 'communityRecipes', id));
      showSuccess("Recipe removed from community feed.");
    } catch (err) {
      setErrorMsg("Failed to remove recipe.");
    }
  };

  const toggleListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return setErrorMsg("Speech recognition not supported in this browser.");
    
    if (isListening) {
      recognition.stop();
      setIsListening(false);
      if (micTimeoutRef.current) clearTimeout(micTimeoutRef.current);
    } else {
      recognition.continuous = true; 
      const resetTimeout = () => {
        if (micTimeoutRef.current) clearTimeout(micTimeoutRef.current);
        micTimeoutRef.current = setTimeout(() => { recognition.stop(); setIsListening(false); }, 5000); 
      };

      recognition.onresult = (e) => {
        const transcriptChunk = e.results[e.results.length - 1][0].transcript;
        setPrompt((prev) => prev ? `${prev} ${transcriptChunk}` : transcriptChunk);
        resetTimeout();
      };

      recognition.onerror = () => { setIsListening(false); clearTimeout(micTimeoutRef.current); };
      recognition.onend = () => { setIsListening(false); clearTimeout(micTimeoutRef.current); };

      recognition.start();
      setIsListening(true);
      resetTimeout(); 
    }
  };

  const toggleKitchenListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (isKitchenListening) {
      recognition.stop();
      setIsKitchenListening(false);
    } else {
      recognition.continuous = true; 
      recognition.onresult = (e) => {
        const transcript = e.results[e.results.length - 1][0].transcript.toLowerCase();
        if (transcript.includes('next')) setKitchenStep((prev) => Math.min(prev + 1, (currentRecipe?.instructions?.length || 1) - 1));
        else if (transcript.includes('back') || transcript.includes('previous')) setKitchenStep((prev) => Math.max(prev - 1, 0));
        else if (transcript.includes('read') || transcript.includes('repeat')) {
          const currentText = currentRecipe?.instructions[kitchenStepRef.current];
          if (currentText) toggleSpeech([currentText]);
        } else if (transcript.includes('scroll down')) kitchenScrollRef.current?.scrollBy({ top: 400, behavior: 'smooth' });
        else if (transcript.includes('scroll up')) kitchenScrollRef.current?.scrollBy({ top: -400, behavior: 'smooth' });
        else if (transcript.includes('start timer') && detectedTime) setIsTimerRunning(true);
        else if (transcript.includes('stop timer')) setIsTimerRunning(false);
        else if (transcript.includes('exit') || transcript.includes('close')) {
          setIsKitchenMode(false); recognition.stop(); setIsKitchenListening(false);
        }
      };
      recognition.onerror = () => setIsKitchenListening(false);
      recognition.onend = () => setIsKitchenListening(false);
      recognition.start();
      setIsKitchenListening(true);
    }
  };

  useEffect(() => {
    if (!isKitchenMode && isKitchenListening && recognitionRef.current) {
       recognitionRef.current.stop();
       setIsKitchenListening(false);
    }
  }, [isKitchenMode, isKitchenListening]);

  const toggleSpeech = (textArr) => {
    if (!window.speechSynthesis) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      const utterance = new SpeechSynthesisUtterance((textArr || []).map(t => typeof t === 'object' ? JSON.stringify(t) : t).join('. '));
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  useEffect(() => {
    return () => { if (window.speechSynthesis) window.speechSynthesis.cancel(); };
  }, [view]);

  const playTimerChime = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'bell';
      osc.frequency.setValueAtTime(880, ctx.currentTime); 
      gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.5);
    } catch (e) { }
  };

  useEffect(() => {
    if (!isKitchenMode || !currentRecipe?.instructions) return;
    setIsTimerRunning(false);
    setDetectedTime(null);
    setTimerSeconds(0);
    setInitialTimerSeconds(0);

    const stepText = currentRecipe.instructions[kitchenStep];
    const stringText = typeof stepText === 'object' ? JSON.stringify(stepText) : stepText;
    const match = stringText.match(/\b(\d+)\s*(minute|min|hour|hr)s?\b/i);

    if (match) {
      const amount = parseInt(match[1], 10);
      const isHour = match[2].toLowerCase().startsWith('h');
      const totalSecs = isHour ? amount * 3600 : amount * 60;
      setDetectedTime(match[0]);
      setInitialTimerSeconds(totalSecs);
      setTimerSeconds(totalSecs);
    }
  }, [kitchenStep, isKitchenMode, currentRecipe]);

  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => setTimerSeconds(prev => prev - 1), 1000);
    } else if (isTimerRunning && timerSeconds === 0) {
      setIsTimerRunning(false);
      playTimerChime();
      showSuccess("Timer Finished!");
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const formatTimerDisplay = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const minsStr = m.toString().padStart(2, '0');
    const secsStr = secs.toString().padStart(2, '0');
    return h > 0 ? `${h}:${minsStr}:${secsStr}` : `${minsStr}:${secsStr}`;
  };

  const shareRecipe = async () => {
    if (navigator.share && currentRecipe) {
      try { await navigator.share({ title: String(currentRecipe.title), text: currentRecipe.description, url: window.location.href }); } catch (err) {}
    } else {
       navigator.clipboard.writeText(`${currentRecipe.title}\n\n${currentRecipe.description}`);
       showSuccess("Recipe copied to clipboard!"); 
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) return setErrorMsg("Image under 5MB please.");
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2C2825] font-sans antialiased selection:bg-[#C2410C]/20">
      
      {/* Navigation (Floating & Elegant) */}
      {user && (
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-[#EBE8E0] print:hidden shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
          <div className="max-w-5xl mx-auto px-5 py-3.5 flex justify-between items-center">
            <div className="flex items-center space-x-2.5 cursor-pointer group" onClick={() => setView('home')}>
              <div className="bg-[#C2410C] text-white p-2 rounded-xl group-hover:scale-105 transition-transform shadow-md shadow-[#C2410C]/20">
                <ChefHat size={20} strokeWidth={2.5} />
              </div>
              <span className="font-serif font-black tracking-tight text-xl text-[#2C2825] hidden sm:inline">Sauté Bot</span>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <button onClick={() => setView('discover')} className={`p-2.5 rounded-full transition-all flex items-center space-x-1.5 ${view === 'discover' ? 'bg-[#2A3F54] text-white shadow-md' : 'text-[#8C7E71] hover:bg-[#F3EFE8] hover:text-[#2C2825]'}`} title="Discover">
                <Globe size={18} strokeWidth={2.5} />
                <span className={`text-sm font-bold hidden md:inline ${view === 'discover' ? 'block' : 'hidden'}`}>Discover</span>
              </button>
              <button onClick={() => setView('planner')} className={`p-2.5 rounded-full transition-all flex items-center space-x-1.5 ${view === 'planner' ? 'bg-[#4A5D4E] text-white shadow-md' : 'text-[#8C7E71] hover:bg-[#F3EFE8] hover:text-[#2C2825]'}`} title="Meal Planner">
                <Calendar size={18} strokeWidth={2.5} />
              </button>
              <button onClick={() => setView('saved')} className={`p-2.5 rounded-full transition-all flex items-center space-x-1.5 ${view === 'saved' ? 'bg-[#C2410C] text-white shadow-md' : 'text-[#8C7E71] hover:bg-[#F3EFE8] hover:text-[#2C2825]'}`} title="My Cookbook">
                <BookOpen size={18} strokeWidth={2.5} />
              </button>
              <button onClick={() => setView('profile')} className={`p-2.5 rounded-full transition-all ${view === 'profile' ? 'bg-[#E6E0D4] text-[#2C2825]' : 'text-[#8C7E71] hover:bg-[#F3EFE8] hover:text-[#2C2825]'}`} title="Profile">
                <User size={18} strokeWidth={2.5} />
              </button>
              <div className="w-px h-5 bg-[#D6D2C9] mx-1"></div>
              <button onClick={handleLogout} className="p-2.5 rounded-full text-[#8C7E71] hover:text-[#DC2626] hover:bg-red-50 transition-colors" title="Log Out">
                <LogOut size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="max-w-5xl mx-auto p-5 py-8 md:py-12">
        
        {/* Universal Floating Toasts */}
        {errorMsg && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] px-5 py-3.5 rounded-2xl shadow-2xl flex justify-between items-center text-sm font-semibold print:hidden animate-in fade-in slide-in-from-top-4">
            <span>{errorMsg}</span>
            <button className="text-[#F87171] hover:text-[#991B1B] p-1" onClick={() => setErrorMsg('')}>&times;</button>
          </div>
        )}
        {successMsg && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md bg-[#F0FDF4] border border-[#86EFAC] text-[#166534] px-5 py-3.5 rounded-2xl shadow-2xl flex justify-between items-center text-sm font-semibold print:hidden animate-in fade-in slide-in-from-top-4">
            <span>{successMsg}</span>
            <button className="text-[#4ADE80] hover:text-[#166534] p-1" onClick={() => setSuccessMsg('')}>&times;</button>
          </div>
        )}

        {!user ? (
          /* --- AUTH VIEW --- */
          <div className="max-w-md mx-auto bg-white rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#EBE8E0] p-8 md:p-12 mt-12 animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center mb-10">
              <div className="w-20 h-20 bg-[#FAF5E6] rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                <ChefHat size={36} className="text-[#C2410C]" strokeWidth={2} />
              </div>
              <h2 className="text-3xl font-serif font-black text-[#2C2825] tracking-tight">{isLoginView ? 'Welcome to the Kitchen' : 'Begin Your Journey'}</h2>
              <p className="text-[#8C7E71] mt-3 text-sm font-medium">Log in to sync your culinary creations.</p>
            </div>
            
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <input 
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#FAF8F3] border border-[#EBE8E0] focus:bg-white text-[#2C2825] text-sm rounded-2xl p-4 focus:border-[#C2410C] focus:ring-4 focus:ring-[#C2410C]/10 outline-none transition-all placeholder:text-[#A89F91] font-medium"
                  placeholder="Email address"
                />
              </div>
              <div>
                <input 
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#FAF8F3] border border-[#EBE8E0] focus:bg-white text-[#2C2825] text-sm rounded-2xl p-4 focus:border-[#C2410C] focus:ring-4 focus:ring-[#C2410C]/10 outline-none transition-all placeholder:text-[#A89F91] font-medium"
                  placeholder="Password"
                />
              </div>
              <button type="submit" disabled={authLoading} className="w-full bg-[#C2410C] hover:bg-[#A3360A] text-white font-bold py-4 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-70 flex justify-center items-center mt-8 shadow-lg shadow-[#C2410C]/20">
                {authLoading ? <Loader2 className="animate-spin" size={20} /> : (isLoginView ? 'Enter Kitchen' : 'Create Account')}
              </button>
            </form>

            <div className="mt-8 text-center">
              <button onClick={() => { setIsLoginView(!isLoginView); setErrorMsg(''); }} className="text-[#8C7E71] hover:text-[#2C2825] text-sm font-bold transition-colors">
                {isLoginView ? "New here? Create an account" : "Already a chef? Log in"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* --- HOME VIEW (The "Aesthetic Awesome" Update) --- */}
            {view === 'home' && (
              <div className="flex flex-col items-center justify-center min-h-[75vh] w-full max-w-3xl mx-auto animate-in fade-in duration-700 slide-in-from-bottom-8">
                
                <div className="w-full text-center space-y-4 mb-10">
                  <h1 className="text-5xl md:text-7xl font-serif font-black text-[#2C2825] tracking-tighter leading-tight">
                    Hello, Chef. <br/> <span className="text-[#8C7E71] font-light italic">What are we creating?</span>
                  </h1>
                </div>

                {/* Elegant Input Section */}
                <div className="w-full relative group bg-white rounded-[2rem] shadow-[0_12px_40px_rgb(0,0,0,0.06)] border border-[#EBE8E0] p-2 focus-within:shadow-[0_12px_40px_rgb(194,65,12,0.1)] focus-within:border-[#C2410C]/50 transition-all duration-500">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="List ingredients, paste a recipe/video link, or describe your craving..."
                    className="w-full h-36 md:h-40 bg-transparent text-[#2C2825] text-lg md:text-xl px-6 pt-6 outline-none resize-none placeholder:text-[#A89F91] leading-relaxed font-medium"
                  />
                  
                  {/* Actions & Image Preview */}
                  <div className="flex justify-between items-end px-3 pb-3">
                    <div className="flex items-center pl-2 space-x-3">
                      {selectedImage && (
                        <div className="relative inline-block group/img animate-in zoom-in-95">
                          <img src={selectedImage} alt="Ingredients" className="h-16 w-16 object-cover rounded-xl border-2 border-white shadow-md" />
                          <button 
                            onClick={() => setSelectedImage(null)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 hover:scale-110 transition-all"
                          >
                            <X size={12} strokeWidth={3} />
                          </button>
                        </div>
                      )}

                      {/* Video/Link Detected Badge */}
                      {detectedLink && !selectedImage && (
                        <div className="bg-[#FAF8F3] border border-[#EBE8E0] text-[#C2410C] px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 animate-in fade-in slide-in-from-left-2 shadow-sm">
                          <LinkIcon size={14} strokeWidth={3} />
                          <span className="truncate max-w-[100px] md:max-w-[150px] text-[#2C2825]">{detectedLink.hostname}</span>
                          <span className="text-[#8C7E71] hidden sm:inline">Attached</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={toggleListening}
                        className={`p-3.5 rounded-full transition-all duration-300 ${isListening ? 'bg-[#C2410C] text-white shadow-lg shadow-[#C2410C]/30 animate-pulse' : 'bg-[#FAF8F3] text-[#8C7E71] hover:bg-[#F3EFE8] hover:text-[#2C2825]'}`}
                        title="Dictate ingredients"
                      >
                        <Mic size={22} strokeWidth={2.5} />
                      </button>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className={`p-3.5 rounded-full transition-all duration-300 ${selectedImage ? 'bg-[#C2410C] text-white shadow-lg shadow-[#C2410C]/30' : 'bg-[#FAF8F3] text-[#8C7E71] hover:bg-[#F3EFE8] hover:text-[#2C2825]'}`}
                        title="Snap a photo of your fridge"
                      >
                        <Camera size={22} strokeWidth={2.5} />
                      </button>
                      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
                      
                      {/* Big Submit Button inside input area for desktop */}
                      <button
                        onClick={generateRecipe}
                        disabled={isGenerating || (!prompt.trim() && !selectedImage)}
                        className="hidden md:flex bg-[#C2410C] hover:bg-[#A3360A] text-white px-8 py-3.5 rounded-full font-bold text-[15px] transition-all duration-300 hover:shadow-lg hover:shadow-[#C2410C]/30 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none items-center space-x-2 ml-2"
                      >
                        {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
                        <span>{isGenerating ? (generationStep === 'Extracting video recipe...' ? 'Extracting...' : 'Crafting...') : 'Generate'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mobile Generate Button */}
                <button
                  onClick={generateRecipe}
                  disabled={isGenerating || (!prompt.trim() && !selectedImage)}
                  className="md:hidden mt-6 w-full bg-[#C2410C] text-white px-8 py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center space-x-2 shadow-lg shadow-[#C2410C]/20 disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
                  <span>{isGenerating ? (generationStep === 'Extracting video recipe...' ? 'Extracting Link...' : 'Crafting Recipe...') : 'Generate Recipe'}</span>
                </button>

                {/* Inspiration Chips */}
                {!prompt && !selectedImage && (
                  <div className="flex flex-col items-center mt-8 animate-in fade-in delay-200 min-h-[80px]">
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="text-xs font-bold text-[#8C7E71] uppercase tracking-widest">Quick Ideas</span>
                    </div>
                    
                    <div className="flex flex-wrap justify-center gap-2.5">
                      {inspirationChips.length === 0 || isLoadingIdeas ? (
                        <div className="flex space-x-2 items-center text-[#8C7E71] text-sm py-2">
                           <Loader2 size={16} className="animate-spin text-[#C2410C]" />
                           <span>Crafting fresh ideas...</span>
                        </div>
                      ) : (
                        inspirationChips.map((idea, idx) => (
                          <button 
                            key={idx}
                            onClick={() => setPrompt(idea)} 
                            className="bg-white border border-[#EBE8E0] text-[#5C5449] hover:border-[#C2410C] hover:text-[#C2410C] px-4 py-2 rounded-full text-sm font-medium transition-all shadow-sm active:scale-95"
                          >
                            {idea}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --- LOADING/RECIPE VIEW --- */}
            {view === 'recipe' && (
              <div className="animate-in fade-in duration-500">
                {(isGenerating || isTweaking) && !currentRecipe && (
                  <div className="flex flex-col items-center justify-center py-32 space-y-8">
                    <div className="relative">
                      <div className="w-24 h-24 border-4 border-[#F3EFE8] rounded-full"></div>
                      <div className="w-24 h-24 border-4 border-[#C2410C] rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                      <Utensils size={32} className="text-[#C2410C] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    <p className="text-xl font-serif font-bold text-[#5C5449] animate-pulse">
                      {generationStep}
                    </p>
                  </div>
                )}

                {currentRecipe && (
                  <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#EBE8E0] overflow-hidden print:shadow-none print:border-none print:rounded-none">
                    
                    {/* Header Section */}
                    <div className="p-6 md:p-12 border-b border-[#EBE8E0] relative bg-[#FDFBF7]">
                      {isTweaking && (
                         <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center animate-in fade-in">
                           <Loader2 className="animate-spin text-[#C2410C] mb-4" size={40} />
                           <span className="text-lg font-serif font-bold text-[#2C2825]">Tweaking Recipe...</span>
                         </div>
                      )}
                      
                      <div className="flex justify-between items-center mb-8 print:hidden">
                        <button onClick={() => setView('home')} className="flex items-center text-sm font-bold text-[#8C7E71] hover:text-[#C2410C] transition-colors group tracking-wide uppercase">
                          <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Kitchen
                        </button>
                        
                        {currentRecipe.publishedBy && (
                          <div className="flex items-center space-x-1.5 bg-[#2A3F54] text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase shadow-sm">
                            <Globe size={14} />
                            <span>By {currentRecipe.publishedBy}</span>
                          </div>
                        )}
                      </div>
                      
                      <h1 className="text-4xl md:text-6xl font-serif font-black text-[#2C2825] tracking-tight leading-[1.1] mb-6">
                        {currentRecipe.title}
                      </h1>
                      <p className="text-lg md:text-xl text-[#5C5449] leading-relaxed md:max-w-3xl font-medium">
                        {currentRecipe.description}
                      </p>

                      <div className="flex flex-wrap gap-3 mt-8">
                         <QuickBadge icon={<Clock size={16}/>} text={currentRecipe.prepTime || 'N/A'} />
                         <QuickBadge icon={<Flame size={16} className="text-[#C2410C]"/>} text={`${Math.round((currentRecipe.totalNutrition?.calories || 0) * portionMultiplier)} kcal`} bgColor="bg-[#FFF5F0]" textColor="text-[#9A3412]" />
                      </div>

                      {/* Action Bar */}
                      <div className="flex flex-wrap items-center gap-3 mt-10 print:hidden">
                        <button onClick={saveRecipeToDB} className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-[#C2410C] hover:bg-[#A3360A] text-white px-6 py-4 rounded-xl font-bold transition-all hover:shadow-lg active:scale-[0.98]">
                          <Save size={18} /> <span>Save to Cookbook</span>
                        </button>
                        <button onClick={shareRecipe} className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-white border border-[#EBE8E0] hover:border-[#C2410C] hover:text-[#C2410C] text-[#2C2825] px-6 py-4 rounded-xl font-bold transition-all active:scale-[0.98] shadow-sm">
                          <Share2 size={18} /> <span className="hidden sm:inline">Share</span>
                        </button>
                        <button onClick={() => window.print()} className="flex items-center justify-center bg-white border border-[#EBE8E0] hover:bg-[#F3EFE8] text-[#2C2825] p-4 rounded-xl font-bold transition-all active:scale-[0.98] shadow-sm">
                          <Printer size={18} />
                        </button>
                        
                        {!currentRecipe.publishedBy && (
                           <button onClick={publishToCommunity} className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-[#2A3F54] hover:bg-[#1C2A38] text-white px-6 py-4 rounded-xl font-bold transition-all active:scale-[0.98] shadow-md ml-auto">
                             <Globe size={18} /> <span className="hidden sm:inline">Publish to Community</span>
                           </button>
                        )}
                      </div>
                    </div>

                    <div className="p-6 md:p-12 bg-white">
                      <div className="grid lg:grid-cols-[1fr_1.5fr] gap-12 lg:gap-20">
                        
                        {/* Left Column: Ingredients & Macros */}
                        <div className="space-y-10">
                          
                          {/* Portion Scaler UI */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between bg-[#FAF8F3] p-4 rounded-2xl border border-[#EBE8E0] print:hidden">
                            <div className="flex items-center space-x-3 mb-4 md:mb-0">
                              <div className="bg-[#E6E0D4] p-2 rounded-xl text-[#5C5449]">
                                <Users size={20} strokeWidth={2.5} />
                              </div>
                              <div>
                                <h4 className="font-bold text-[#2C2825]">Adjust Portions</h4>
                                <p className="text-xs text-[#8C7E71] font-medium">Scale ingredients & nutrition</p>
                              </div>
                            </div>
                            <div className="flex bg-white rounded-xl border border-[#EBE8E0] p-1 shadow-sm shrink-0">
                              {[0.5, 1, 2, 4].map(mult => (
                                <button
                                  key={mult}
                                  onClick={() => setPortionMultiplier(mult)}
                                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${portionMultiplier === mult ? 'bg-[#C2410C] text-white shadow-md' : 'text-[#8C7E71] hover:text-[#2C2825] hover:bg-[#FAF8F3]'}`}
                                >
                                  {mult}x
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <NutritionPill label="Protein" value={`${Math.round((currentRecipe.totalNutrition?.protein || 0) * portionMultiplier)}g`} />
                            <NutritionPill label="Carbs" value={`${Math.round((currentRecipe.totalNutrition?.carbs || 0) * portionMultiplier)}g`} />
                            <NutritionPill label="Fat" value={`${Math.round((currentRecipe.totalNutrition?.fat || 0) * portionMultiplier)}g`} />
                          </div>

                          <div>
                            <h3 className="text-2xl font-serif font-black text-[#2C2825] mb-6 flex items-center">
                              Ingredients
                            </h3>
                            <ul className="space-y-4">
                              {(currentRecipe.ingredients || []).map((ing, idx) => (
                                <li key={idx} className="group border-b border-[#F3EFE8] pb-4 print:border-b transition-all">
                                  <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 shrink-0 bg-[#FAF8F3] rounded-xl overflow-hidden print:hidden relative flex items-center justify-center p-1 group-hover:scale-105 transition-transform duration-300 shadow-sm border border-[#EBE8E0]">
                                      {/* --- NEW: Pass base_name fallback to Icon --- */}
                                      <IngredientIcon ingredient={ing} />
                                    </div>
                                    <div className="flex-1 min-w-0 py-1">
                                      <div className="flex justify-between items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div className="text-[#2C2825] leading-snug break-words text-[17px]">
                                            <span className="font-black">{scaleQuantity(ing?.quantity, portionMultiplier)}</span>
                                            <span className="font-medium ml-2">{String(ing?.name || 'Unknown')}</span>
                                          </div>
                                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[11px] font-bold text-[#8C7E71] uppercase tracking-wider">
                                            <span className="flex items-center text-[#C2410C] bg-[#FFF5F0] px-2 py-0.5 rounded shrink-0">
                                              {Math.round((ing?.nutrition?.calories || 0) * portionMultiplier)} Cal
                                            </span>
                                            <span className="shrink-0">P: {Math.round((ing?.nutrition?.protein || 0) * portionMultiplier)}g</span>
                                            <span className="text-[#D6D2C9] shrink-0">•</span>
                                            <span className="shrink-0">C: {Math.round((ing?.nutrition?.carbs || 0) * portionMultiplier)}g</span>
                                            <span className="text-[#D6D2C9] shrink-0">•</span>
                                            <span className="shrink-0">F: {Math.round((ing?.nutrition?.fat || 0) * portionMultiplier)}g</span>
                                          </div>
                                        </div>
                                        
                                        {/* Quick Commerce Minimalist Logos */}
                                        <div className="flex flex-row space-x-2 shrink-0 print:hidden mt-0.5 opacity-40 group-hover:opacity-100 transition-all duration-300">
                                          <a href={`https://blinkit.com/s/?q=${encodeURIComponent(String(ing?.base_name || ing?.name || ''))}`} target="_blank" rel="noreferrer" 
                                              className="w-8 h-8 rounded-full border border-[#EBE8E0] bg-white shadow-sm flex items-center justify-center hover:scale-110 hover:shadow-md transition-all hover:border-[#F8CB46] group/blinkit" title="Order on Blinkit">
                                            <img src="https://www.google.com/s2/favicons?domain=blinkit.com&sz=128" alt="Blinkit" className="w-5 h-5 rounded-md grayscale opacity-70 group-hover/blinkit:grayscale-0 group-hover/blinkit:opacity-100 transition-all" onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=B&background=F8CB46&color=000&font-size=0.6'; }}/>
                                          </a>
                                          <a href={`https://www.swiggy.com/instamart/search?custom_back=true&query=${encodeURIComponent(String(ing?.base_name || ing?.name || ''))}`} target="_blank" rel="noreferrer" 
                                              className="w-8 h-8 rounded-full border border-[#EBE8E0] bg-white shadow-sm flex items-center justify-center hover:scale-110 hover:shadow-md transition-all hover:border-[#fc8019] group/instamart" title="Order on Instamart">
                                            <img src="https://www.google.com/s2/favicons?domain=swiggy.com&sz=128" alt="Instamart" className="w-5 h-5 rounded-md grayscale opacity-70 group-hover/instamart:grayscale-0 group-hover/instamart:opacity-100 transition-all" onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=S&background=fc8019&color=fff&font-size=0.6'; }}/>
                                          </a>
                                        </div>
                                        
                                      </div>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Right Column: Instructions */}
                        <div>
                          <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-serif font-black text-[#2C2825]">
                              Instructions
                            </h3>
                            <div className="flex items-center space-x-3 print:hidden">
                              <button 
                                onClick={() => { setIsKitchenMode(true); setKitchenStep(0); }}
                                className="flex items-center space-x-2 text-sm bg-[#2C2825] text-white px-4 py-2 rounded-full hover:bg-black font-bold transition-all shadow-md hover:shadow-lg"
                              >
                                <Maximize size={16} />
                                <span className="hidden sm:inline">Kitchen Mode</span>
                              </button>
                              <button 
                                onClick={() => toggleSpeech(currentRecipe.instructions)}
                                className="flex items-center space-x-2 text-sm bg-[#FAF5E6] text-[#C2410C] px-4 py-2 rounded-full hover:bg-[#F3EFE8] font-bold transition-colors border border-[#EBE8E0]"
                              >
                                {isSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
                                <span className="hidden sm:inline">{isSpeaking ? 'Stop' : 'Listen'}</span>
                              </button>
                            </div>
                          </div>
                          
                          <ol className="space-y-8 relative">
                            <div className="absolute left-6 top-4 bottom-4 w-px bg-[#EBE8E0] print:hidden"></div>
                            {(currentRecipe.instructions || []).map((step, idx) => (
                              <li key={idx} className="flex relative z-10 group">
                                <span className="shrink-0 w-12 h-12 rounded-full bg-[#FDFBF7] border-4 border-white shadow-sm text-[#C2410C] flex items-center justify-center font-serif font-black text-xl mr-6 print:border-none print:bg-transparent print:text-black print:mr-3 group-hover:scale-110 group-hover:bg-[#C2410C] group-hover:text-white transition-all duration-300">
                                  {idx + 1}
                                </span>
                                <p className="text-[#4A443F] leading-relaxed text-[17px] pt-2.5 break-words min-w-0 font-medium">
                                  {typeof step === 'object' ? JSON.stringify(step) : step}
                                </p>
                              </li>
                            ))}
                          </ol>
                        </div>

                      </div>
                    </div>

                    {/* Tweak Recipe Section */}
                    <div className="bg-[#FAF8F3] border-t border-[#EBE8E0] p-6 md:p-12 print:hidden">
                      <div className="flex items-center space-x-3 mb-6">
                        <div className="bg-purple-100 p-2 rounded-xl">
                          <Wand2 className="text-purple-700" size={20} strokeWidth={2.5}/>
                        </div>
                        <div>
                           <h3 className="text-xl font-serif font-black text-[#2C2825]">Tweak this recipe</h3>
                           <p className="text-sm text-[#8C7E71] font-medium">Make it vegan, spicier, or double the portions.</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3 bg-white p-2.5 rounded-[1.5rem] border border-[#EBE8E0] shadow-sm focus-within:shadow-md focus-within:border-purple-300 focus-within:ring-4 focus-within:ring-purple-500/10 transition-all duration-300">
                        <input
                          type="text"
                          value={tweakPrompt}
                          onChange={(e) => setTweakPrompt(e.target.value)}
                          placeholder="e.g. Swap the chicken for paneer..."
                          className="flex-1 bg-transparent text-[#2C2825] text-[16px] px-4 outline-none placeholder:text-[#A89F91] font-medium"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') tweakRecipe();
                          }}
                        />
                        <button
                          onClick={tweakRecipe}
                          disabled={isTweaking || !tweakPrompt.trim()}
                          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center font-bold space-x-2 shadow-sm"
                        >
                          {isTweaking ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                          <span className="hidden sm:inline">{isTweaking ? 'Updating...' : 'Tweak'}</span>
                        </button>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* --- DISCOVER / COMMUNITY VIEW --- */}
            {view === 'discover' && (
              <div className="animate-in fade-in duration-500 w-full">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                   <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 bg-[#2A3F54] rounded-2xl flex items-center justify-center shadow-lg">
                      <Globe className="text-white" size={28} strokeWidth={2}/> 
                    </div>
                    <div>
                      <h2 className="text-4xl font-serif font-black text-[#2C2825] tracking-tight">Discover</h2>
                      <p className="text-[#8C7E71] font-medium mt-1">Explore recipes crafted by the community.</p>
                    </div>
                  </div>
                </div>
                
                {(communityRecipes || []).length === 0 ? (
                  <div className="text-center py-32 bg-white rounded-[2rem] border border-dashed border-[#EBE8E0]">
                    <Globe size={48} className="mx-auto mb-4 text-[#D6D2C9]" />
                    <p className="text-[#8C7E71] font-medium text-lg">The kitchen is quiet. Be the first to publish a recipe!</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {(communityRecipes || []).map((recipe) => (
                      <div key={recipe.id} className="bg-white rounded-[2rem] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-[#EBE8E0] p-6 hover:shadow-[0_12px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 group flex flex-col relative overflow-hidden cursor-pointer" onClick={() => { setCurrentRecipe(recipe); setView('recipe'); }}>
                        
                        <div className="absolute top-0 right-0 bg-[#F3EFE8] text-[#5C5449] text-[10px] font-bold px-4 py-2 rounded-bl-2xl">
                           @{recipe.publishedBy || 'Chef'}
                        </div>

                        <div className="mt-4 flex justify-between items-start mb-3">
                          <h3 className="text-xl font-serif font-black text-[#2C2825] leading-snug line-clamp-2 pr-2 group-hover:text-[#C2410C] transition-colors">{String(recipe.title || 'Recipe')}</h3>
                          {recipe.publisherUid === user?.uid && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteCommunityRecipe(recipe.id, recipe.publisherUid); }}
                              className="text-[#A89F91] hover:text-red-500 bg-[#FAF8F3] hover:bg-red-50 p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-all shrink-0 z-10 shadow-sm"
                              title="Remove from Community"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-[#8C7E71] mb-6 line-clamp-3 font-medium flex-grow leading-relaxed">{String(recipe.description || '')}</p>
                        
                        <div className="flex space-x-2 pt-4 border-t border-[#F3EFE8]">
                           <span className="text-xs font-bold bg-[#FAF8F3] text-[#5C5449] px-3 py-1.5 rounded-lg border border-[#EBE8E0] flex items-center"><Clock size={12} className="mr-1.5 opacity-70"/>{String(recipe.prepTime || 'N/A')}</span>
                           <span className="text-xs font-bold bg-[#FFF5F0] text-[#9A3412] px-3 py-1.5 rounded-lg flex items-center"><Flame size={12} className="mr-1.5 opacity-70"/>{recipe.totalNutrition?.calories || 0} kcal</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* --- MEAL PLANNER VIEW --- */}
            {view === 'planner' && (
              <div className="animate-in fade-in duration-500 w-full flex flex-col lg:flex-row gap-8">
                
                {/* Left Side: Recipe Bank */}
                <div className="w-full lg:w-1/3 bg-white rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#EBE8E0] p-8 flex flex-col max-h-[85vh]">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-12 h-12 bg-[#4A5D4E] rounded-xl flex items-center justify-center shadow-md">
                      <BookOpen className="text-white" size={22} strokeWidth={2}/> 
                    </div>
                    <h2 className="text-3xl font-serif font-black text-[#2C2825]">Your Recipes</h2>
                  </div>
                  <p className="text-sm text-[#8C7E71] font-medium mb-8">
                    Drag and drop your saved recipes onto the calendar to plan your meals.
                  </p>

                  <div className="overflow-y-auto pr-2 space-y-4 flex-1 pb-4">
                    {savedRecipes.length === 0 ? (
                      <div className="text-center py-16 border-2 border-dashed border-[#EBE8E0] rounded-3xl">
                        <p className="text-[#8C7E71] font-medium">Your cookbook is empty.</p>
                      </div>
                    ) : null}
                    {savedRecipes.map(recipe => (
                       <div
                         key={recipe.id}
                         draggable
                         onDragStart={(e) => handleDragStart(e, recipe)}
                         className="bg-[#FAF8F3] p-5 rounded-2xl border border-[#EBE8E0] cursor-grab active:cursor-grabbing hover:border-[#4A5D4E]/50 hover:shadow-md transition-all select-none group"
                       >
                         <h4 className="font-bold text-[#2C2825] text-[15px] line-clamp-2 leading-snug group-hover:text-[#4A5D4E] transition-colors">{recipe.title}</h4>
                         <div className="flex items-center space-x-3 mt-3">
                           <span className="text-[11px] font-bold text-[#C2410C] flex items-center"><Flame size={12} className="mr-1"/>{recipe.totalNutrition?.calories || 0} kcal</span>
                           <span className="text-[#D6D2C9] shrink-0">•</span>
                           <span className="text-[11px] font-bold text-[#8C7E71] flex items-center"><Clock size={12} className="mr-1"/>{recipe.prepTime || 'N/A'}</span>
                         </div>
                       </div>
                    ))}
                  </div>
                </div>

                {/* Right Side: Weekly Calendar */}
                <div className="w-full lg:w-2/3">
                   <div className="flex items-center space-x-4 mb-10">
                    <div className="w-14 h-14 bg-white border border-[#EBE8E0] shadow-sm rounded-2xl flex items-center justify-center text-[#4A5D4E]">
                      <Calendar size={28} strokeWidth={2}/> 
                    </div>
                    <h2 className="text-4xl font-serif font-black text-[#2C2825] tracking-tight">Meal Plan</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                     {DAYS.map(day => (
                       <div key={day} className="bg-white rounded-[2rem] shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-[#EBE8E0] p-6">
                         <h3 className="font-serif font-black text-xl text-[#2C2825] mb-5 border-b border-[#F3EFE8] pb-3">{day}</h3>
                         <div className="space-y-4">
                           {MEALS.map(meal => (
                             <div
                               key={meal}
                               onDragOver={(e) => e.preventDefault()}
                               onDrop={(e) => handleDrop(e, day, meal)}
                               className={`min-h-[90px] rounded-2xl border-2 border-dashed flex flex-col p-4 transition-all duration-300 ${
                                 mealPlan[day]?.[meal] ? 'bg-[#F0FDF4] border-[#86EFAC]' : 'bg-[#FAF8F3] border-[#EBE8E0] hover:bg-[#F3EFE8]'
                               }`}
                             >
                                <span className="text-[11px] font-bold text-[#A89F91] uppercase tracking-widest mb-2">{meal}</span>
                                {mealPlan[day]?.[meal] ? (
                                  <div className="relative group flex-1 flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-[#bbf7d0]">
                                    <p 
                                      className="text-sm font-bold text-[#166534] leading-snug line-clamp-2 pr-8 cursor-pointer hover:underline" 
                                      onClick={() => { setCurrentRecipe(mealPlan[day][meal]); setView('recipe'); }}
                                    >
                                      {mealPlan[day][meal].title}
                                    </p>
                                    <button 
                                      onClick={() => handleRemoveMeal(day, meal)} 
                                      className="text-[#A89F91] hover:text-red-500 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-1/2 -translate-y-1/2 bg-white rounded-full shadow-sm hover:bg-red-50"
                                    >
                                      <X size={14} strokeWidth={3} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex-1 flex items-center justify-center text-[#D6D2C9] text-xs font-bold">
                                    Drop recipe here
                                  </div>
                                )}
                             </div>
                           ))}
                         </div>
                       </div>
                     ))}
                  </div>
                </div>

              </div>
            )}

            {/* --- PROFILE VIEW --- */}
            {view === 'profile' && (
              <div className="max-w-xl mx-auto bg-white rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#EBE8E0] p-8 md:p-12 animate-in fade-in zoom-in-95 duration-500">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-14 h-14 bg-[#E6E0D4] rounded-2xl flex items-center justify-center">
                    <User className="text-[#5C5449]" size={28} strokeWidth={2}/> 
                  </div>
                  <h2 className="text-4xl font-serif font-black text-[#2C2825]">Your Profile</h2>
                </div>
                <p className="text-[#8C7E71] mb-10 text-[15px] font-medium">Used to deeply personalize your AI culinary recommendations.</p>
                
                <form onSubmit={saveProfile} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-[#8C7E71] uppercase tracking-wider mb-2.5 ml-1">Age</label>
                      <input 
                        type="number" 
                        value={profileData.age} 
                        onChange={(e) => setProfileData({...profileData, age: e.target.value})}
                        className="w-full bg-[#FAF8F3] border border-[#EBE8E0] focus:bg-white text-[#2C2825] text-[15px] rounded-2xl p-4 focus:border-[#C2410C] focus:ring-4 focus:ring-[#C2410C]/10 outline-none transition-all font-medium"
                        placeholder="e.g. 28"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#8C7E71] uppercase tracking-wider mb-2.5 ml-1">Origin / Cuisine</label>
                      <input 
                        type="text" 
                        value={profileData.nationality} 
                        onChange={(e) => setProfileData({...profileData, nationality: e.target.value})}
                        className="w-full bg-[#FAF8F3] border border-[#EBE8E0] focus:bg-white text-[#2C2825] text-[15px] rounded-2xl p-4 focus:border-[#C2410C] focus:ring-4 focus:ring-[#C2410C]/10 outline-none transition-all font-medium"
                        placeholder="e.g. Italian"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-[#8C7E71] uppercase tracking-wider mb-2.5 ml-1">Dietary Preferences & History</label>
                    <textarea 
                      value={profileData.preferences} 
                      onChange={(e) => setProfileData({...profileData, preferences: e.target.value})}
                      className="w-full h-32 bg-[#FAF8F3] border border-[#EBE8E0] focus:bg-white text-[#2C2825] text-[15px] rounded-2xl p-4 focus:border-[#C2410C] focus:ring-4 focus:ring-[#C2410C]/10 outline-none transition-all resize-none font-medium leading-relaxed"
                      placeholder="e.g. Vegetarian, keto, allergic to peanuts. Usually cooks for 2."
                    />
                  </div>

                  <button type="submit" className="w-full bg-[#2C2825] hover:bg-black text-white font-bold py-4.5 rounded-2xl transition-all active:scale-[0.98] mt-6 shadow-xl shadow-[#2C2825]/20 text-[16px]">
                    Save Profile
                  </button>
                </form>
              </div>
            )}

            {/* --- SAVED RECIPES VIEW --- */}
            {view === 'saved' && (
              <div className="animate-in fade-in duration-500 w-full">
                 <div className="flex items-center space-x-4 mb-10">
                  <div className="w-14 h-14 bg-[#C2410C] rounded-2xl flex items-center justify-center shadow-lg shadow-[#C2410C]/30">
                    <BookOpen className="text-white" size={28} strokeWidth={2}/> 
                  </div>
                  <h2 className="text-4xl font-serif font-black text-[#2C2825] tracking-tight">My Cookbook</h2>
                </div>
                
                {(savedRecipes || []).length === 0 ? (
                  <div className="text-center py-32 bg-white rounded-[2rem] border border-dashed border-[#EBE8E0]">
                    <BookOpen size={48} className="mx-auto mb-4 text-[#D6D2C9]" />
                    <p className="text-[#8C7E71] font-medium text-lg">Your cookbook is empty. Generate a recipe to start saving!</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {(savedRecipes || []).map((recipe) => (
                      <div key={recipe.id} className="bg-white rounded-[2rem] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-[#EBE8E0] p-6 hover:shadow-[0_12px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 group flex flex-col cursor-pointer" onClick={() => { setCurrentRecipe(recipe); setView('recipe'); }}>
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="text-xl font-serif font-black text-[#2C2825] leading-snug line-clamp-2 pr-4 group-hover:text-[#C2410C] transition-colors">{String(recipe.title || 'Recipe')}</h3>
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteRecipe(recipe.id); }}
                            className="text-[#A89F91] hover:text-red-500 bg-[#FAF8F3] hover:bg-red-50 p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-all shrink-0 shadow-sm"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <p className="text-sm text-[#8C7E71] mb-6 line-clamp-3 font-medium flex-grow leading-relaxed">{String(recipe.description || '')}</p>
                        
                        <div className="flex space-x-2 pt-4 border-t border-[#F3EFE8]">
                           <span className="text-xs font-bold bg-[#FAF8F3] text-[#5C5449] px-3 py-1.5 rounded-lg border border-[#EBE8E0] flex items-center"><Clock size={12} className="mr-1.5 opacity-70"/>{String(recipe.prepTime || 'N/A')}</span>
                           <span className="text-xs font-bold bg-[#FFF5F0] text-[#9A3412] px-3 py-1.5 rounded-lg flex items-center"><Flame size={12} className="mr-1.5 opacity-70"/>{recipe.totalNutrition?.calories || 0} kcal</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* --- FLOATING SOUS-CHEF BUTTON & CHAT --- */}
            {view === 'recipe' && !isKitchenMode && currentRecipe && (
              <div className="print:hidden">
                {/* Chat Window */}
                {isSousChefOpen && (
                  <div className="fixed bottom-28 right-5 md:right-8 w-[22rem] md:w-[24rem] bg-white rounded-[2rem] shadow-[0_20px_60px_rgb(0,0,0,0.15)] border border-[#EBE8E0] flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-8 fade-in duration-300 h-[32rem] max-h-[75vh]">
                    <div className="bg-[#2C2825] text-white p-5 flex justify-between items-center shadow-md z-10">
                      <div className="flex items-center space-x-3">
                        <div className="bg-[#C2410C] p-1.5 rounded-lg">
                          <ChefHat size={18} />
                        </div>
                        <span className="font-serif font-black tracking-wide text-lg">Sous-Chef</span>
                      </div>
                      <button onClick={() => setIsSousChefOpen(false)} className="text-[#A89F91] hover:text-white transition-colors p-1 bg-white/10 rounded-full hover:bg-white/20">
                        <X size={16} />
                      </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#FDFBF7]">
                      {sousChefMessages.length === 0 && (
                        <div className="text-center text-[#8C7E71] text-sm mt-8 font-medium bg-white p-6 rounded-2xl shadow-sm border border-[#EBE8E0] mx-2">
                          <ChefHat size={24} className="mx-auto mb-3 text-[#D6D2C9]" />
                          Ask me anything about this specific recipe. <br/><br/> <span className="italic">"What can I substitute for garlic?"</span>
                        </div>
                      )}
                      {sousChefMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`px-5 py-3.5 rounded-2xl max-w-[85%] text-[15px] leading-relaxed shadow-sm font-medium ${msg.role === 'user' ? 'bg-[#C2410C] text-white rounded-br-sm' : 'bg-white border border-[#EBE8E0] text-[#2C2825] rounded-bl-sm'}`}>
                            {msg.text}
                          </div>
                        </div>
                      ))}
                      {isSousChefTyping && (
                        <div className="flex justify-start">
                          <div className="bg-white border border-[#EBE8E0] px-5 py-4 rounded-2xl rounded-bl-sm shadow-sm flex items-center space-x-3">
                             <Loader2 size={18} className="text-[#C2410C] animate-spin" />
                             <span className="text-xs font-bold text-[#8C7E71] uppercase tracking-wider">Thinking...</span>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    
                    <div className="p-4 bg-white border-t border-[#EBE8E0]">
                      <div className="flex items-center bg-[#FAF8F3] border border-[#EBE8E0] rounded-full px-2 py-2 focus-within:border-[#C2410C] focus-within:ring-4 focus-within:ring-[#C2410C]/10 transition-all">
                        <input 
                          type="text" 
                          value={sousChefInput}
                          onChange={e => setSousChefInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !isSousChefTyping && sousChefInput.trim()) {
                              handleSendSousChefMessage();
                            }
                          }}
                          placeholder="Ask a question..."
                          className="flex-1 bg-transparent px-4 text-[15px] font-medium outline-none text-[#2C2825] placeholder:text-[#A89F91]"
                        />
                        <button 
                          onClick={handleSendSousChefMessage}
                          disabled={isSousChefTyping || !sousChefInput.trim()}
                          className="p-2.5 bg-[#2C2825] hover:bg-black text-white rounded-full transition-all disabled:opacity-40 shadow-sm"
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Floating Toggle Button */}
                <button 
                  onClick={() => setIsSousChefOpen(!isSousChefOpen)}
                  className={`fixed bottom-8 right-5 md:right-8 p-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.15)] transition-all active:scale-95 z-50 border-4 border-white ${isSousChefOpen ? 'bg-[#2C2825] text-white hover:bg-black' : 'bg-[#C2410C] text-white hover:bg-[#A3360A] hover:-translate-y-1'}`}
                  title="Ask AI Sous-Chef"
                >
                  {isSousChefOpen ? <X size={28} /> : <MessageCircle size={28} />}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* --- KITCHEN Mode OVERLAY --- */}
      {isKitchenMode && currentRecipe && (
        <div className="fixed inset-0 z-[100] bg-[#13171A] text-white flex flex-col animate-in zoom-in-95 duration-300">
          {/* Top Bar */}
          <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="flex items-center space-x-4">
              <button onClick={() => setIsKitchenMode(false)} className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors text-[#A89F91] hover:text-white">
                <X size={24} />
              </button>
              <h2 className="text-xl font-serif font-bold text-white hidden md:block tracking-wide">{currentRecipe.title}</h2>
            </div>
            <button
              onClick={toggleKitchenListening}
              className={`flex items-center space-x-2 px-6 py-3 rounded-full font-bold transition-all shadow-lg border ${isKitchenListening ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse' : 'bg-white/10 text-[#A89F91] border-transparent hover:bg-white/20 hover:text-white'}`}
            >
              <Mic size={20} />
              <span>{isKitchenListening ? 'Listening...' : 'Voice Commands'}</span>
            </button>
          </div>

          {/* Main Instruction Area */}
          <div ref={kitchenScrollRef} className="flex-1 overflow-y-auto w-full grid place-items-center p-6 md:p-16 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
            <div className="text-center max-w-5xl mx-auto w-full flex flex-col items-center py-4">
              <span className="text-[#C2410C] font-black text-lg md:text-xl mb-10 tracking-[0.2em] uppercase bg-[#C2410C]/10 px-6 py-2.5 rounded-full border border-[#C2410C]/20 shadow-inner">
                Step {kitchenStep + 1} of {currentRecipe.instructions.length}
              </span>
              <p className="text-4xl md:text-6xl lg:text-7xl font-serif font-black leading-[1.15] mb-12 text-[#FDFBF7]">
                {typeof currentRecipe.instructions[kitchenStep] === 'object' 
                  ? JSON.stringify(currentRecipe.instructions[kitchenStep]) 
                  : currentRecipe.instructions[kitchenStep]}
              </p>

              {/* Dynamic Timer UI */}
              {detectedTime && (
                <div className="mb-16 flex flex-col items-center animate-in slide-in-from-bottom-8 fade-in">
                  {!isTimerRunning && timerSeconds === initialTimerSeconds ? (
                    <button 
                      onClick={() => setIsTimerRunning(true)}
                      className="flex items-center space-x-3 bg-[#C2410C] text-white px-8 py-4 rounded-full font-bold text-xl hover:bg-[#A3360A] transition-all shadow-lg hover:shadow-[#C2410C]/40 hover:-translate-y-1"
                    >
                      <Timer size={24} />
                      <span>Start Timer ({detectedTime})</span>
                    </button>
                  ) : (
                    <div className="flex items-center space-x-6 bg-white/5 backdrop-blur-md px-10 py-5 rounded-full border border-white/10 shadow-2xl">
                      <span className={`text-5xl font-mono font-black w-40 text-center tracking-wider ${timerSeconds === 0 ? 'text-red-500 animate-pulse' : 'text-[#C2410C]'}`}>
                        {formatTimerDisplay(timerSeconds)}
                      </span>
                      <div className="flex space-x-4 border-l border-white/10 pl-8">
                         <button 
                            onClick={() => setIsTimerRunning(!isTimerRunning)} 
                            className="p-4 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
                          >
                             {isTimerRunning ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
                         </button>
                         <button 
                            onClick={() => { setIsTimerRunning(false); setTimerSeconds(initialTimerSeconds); }} 
                            className="p-4 bg-white/10 text-[#A89F91] rounded-full hover:bg-white/20 hover:text-white transition-colors"
                          >
                             <RotateCcw size={28} />
                         </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Giant Controls */}
              <div className="flex items-center justify-center space-x-8 md:space-x-16 mt-8">
                <button
                  onClick={() => setKitchenStep(s => Math.max(s - 1, 0))}
                  disabled={kitchenStep === 0}
                  className="p-6 md:p-8 bg-white/5 rounded-full text-[#A89F91] hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:hover:bg-white/5 transition-all active:scale-95"
                >
                  <ChevronLeft size={48} strokeWidth={2.5} />
                </button>
                <button
                  onClick={() => toggleSpeech([currentRecipe.instructions[kitchenStep]])}
                  className="p-8 md:p-10 bg-[#C2410C] rounded-full hover:bg-[#A3360A] transition-all active:scale-95 text-white shadow-[0_0_40px_rgb(194,65,12,0.4)]"
                >
                  {isSpeaking ? <VolumeX size={48} strokeWidth={2.5} /> : <Volume2 size={48} strokeWidth={2.5} />}
                </button>
                <button
                  onClick={() => setKitchenStep(s => Math.min(s + 1, currentRecipe.instructions.length - 1))}
                  disabled={kitchenStep === currentRecipe.instructions.length - 1}
                  className="p-6 md:p-8 bg-white/5 rounded-full text-[#A89F91] hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:hover:bg-white/5 transition-all active:scale-95"
                >
                  <ChevronRight size={48} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>

          {/* Helper Footer */}
          <div className="p-5 md:p-8 text-center text-[#8C7E71] font-medium border-t border-white/10 text-xs md:text-sm leading-loose bg-black/20">
            Voice Commands: Say <span className="text-white px-2.5 py-1 bg-white/10 rounded-md shadow-sm border border-white/5 font-bold">"Next"</span>, 
            <span className="text-white px-2.5 py-1 bg-white/10 rounded-md shadow-sm border border-white/5 mx-1.5 font-bold">"Previous"</span>, 
            <span className="text-white px-2.5 py-1 bg-white/10 rounded-md shadow-sm border border-white/5 mx-1.5 font-bold">"Read"</span>, 
            <span className="text-white px-2.5 py-1 bg-white/10 rounded-md shadow-sm border border-white/5 mx-1.5 font-bold">"Scroll Down"</span>, 
            {detectedTime && <span className="text-[#C2410C] px-2.5 py-1 bg-[#C2410C]/10 rounded-md shadow-sm border border-[#C2410C]/20 mx-1.5 font-bold">"Start Timer"</span>} 
            or <span className="text-white px-2.5 py-1 bg-white/10 rounded-md shadow-sm border border-white/5 ml-1.5 font-bold">"Exit"</span>
          </div>
        </div>
      )}

      {/* --- SPOTIFY KITCHEN PLAYER --- */}
      {isKitchenMode && currentRecipe && (
        <div className="print:hidden z-[110]">
          {isSpotifyOpen && (
            <div className="fixed bottom-28 left-5 md:left-8 w-[22rem] md:w-[24rem] bg-[#121212] rounded-[2rem] shadow-[0_20px_60px_rgb(0,0,0,0.5)] border border-[#282828] flex flex-col overflow-hidden z-[110] animate-in slide-in-from-bottom-8 fade-in duration-300 h-[36rem] max-h-[75vh] font-sans">
              {/* Header */}
              <div className="p-5 flex justify-between items-center border-b border-[#282828] bg-[#181818] z-10">
                <span className="text-white font-black text-lg flex items-center gap-2.5 tracking-tight">
                  <Music size={22} className="text-[#1DB954]" strokeWidth={3} /> Spotify
                </span>
                <div className="flex items-center space-x-4">
                  {spotifyToken && (
                    <button onClick={handleSpotifyLogout} className="text-[#b3b3b3] hover:text-white text-[11px] font-bold uppercase tracking-widest transition-colors bg-[#282828] px-3 py-1.5 rounded-full hover:bg-[#333]">
                      Logout
                    </button>
                  )}
                  <button onClick={() => setIsSpotifyOpen(false)} className="text-[#b3b3b3] hover:text-white transition-colors p-1.5 rounded-full hover:bg-[#282828]">
                    <X size={18} strokeWidth={2.5}/>
                  </button>
                </div>
              </div>

              {/* Dynamic Content Area (Library, Playlist, or Search) */}
              <div className="flex-1 overflow-y-auto p-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-[#535353] [&::-webkit-scrollbar-thumb]:rounded-full bg-[#121212]">
                {!spotifyToken ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <div className="w-20 h-20 bg-[#282828] rounded-full flex items-center justify-center text-[#1DB954] mb-2 shadow-lg">
                      <Music size={36} />
                    </div>
                    <h3 className="text-white font-extrabold text-2xl tracking-tight">Log in to Spotify</h3>
                    <p className="text-[#b3b3b3] text-[15px] font-medium leading-relaxed">Connect your account to listen to your personal playlists while cooking.</p>
                    <button onClick={handleSpotifyLogin} className="bg-[#1DB954] text-black font-black rounded-full px-10 py-4 mt-6 hover:scale-105 transition-transform active:scale-95 shadow-[0_0_20px_rgb(29,185,84,0.3)] text-lg">
                      Connect
                    </button>
                  </div>
                ) : (
                  <div className="h-full flex flex-col">
                    {/* Persistent Search Bar Row */}
                    <form onSubmit={handleSpotifySearch} className="px-2 mb-4 mt-2 flex gap-2">
                      <input
                        type="text"
                        placeholder="Search songs or artists..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="flex-1 bg-[#242424] hover:bg-[#2a2a2a] text-white text-[15px] font-medium px-5 py-3.5 rounded-full outline-none focus:bg-[#2a2a2a] focus:ring-2 focus:ring-white/20 placeholder-[#b3b3b3] transition-all"
                      />
                      <button type="submit" className="text-white p-3.5 rounded-full bg-[#242424] hover:bg-[#2a2a2a] transition-colors shadow-sm">
                        <Search size={18} strokeWidth={2.5}/>
                      </button>
                    </form>

                    {/* Loading State */}
                    {isSpotifyLoading ? (
                      <div className="flex-1 flex justify-center items-center mt-10">
                        <Loader2 className="animate-spin text-[#1DB954]" size={40} />
                      </div>
                    ) : spotifyView === 'library' ? (
                      /* --- LIBRARY VIEW --- */
                      <div className="space-y-1.5 pb-4">
                        <h4 className="text-[#b3b3b3] text-xs font-bold uppercase tracking-widest px-3 mb-4 mt-2">Your Library</h4>
                        
                        {/* Liked Songs Tile */}
                        <div 
                          onClick={() => fetchSpotifyTracks('liked', null, 'liked')} 
                          className="flex items-center gap-4 p-2.5 rounded-xl cursor-pointer transition-colors group hover:bg-[#1a1a1a]"
                        >
                          <div className="w-14 h-14 rounded-lg shadow-md flex items-center justify-center bg-gradient-to-br from-indigo-600 to-blue-300 text-white shrink-0">
                            <Heart size={24} fill="currentColor" />
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className="font-bold truncate text-[16px] text-white">Liked Songs</span>
                            <span className="text-[#b3b3b3] text-[13px] truncate font-medium mt-0.5">Saved tracks</span>
                          </div>
                        </div>

                        {/* Playlists Map */}
                        {spotifyPlaylists.map(pl => (
                          <div
                            key={pl.id}
                            onClick={() => fetchSpotifyTracks('playlist', pl.id, pl.uri)}
                            className="flex items-center gap-4 p-2.5 rounded-xl cursor-pointer transition-colors group hover:bg-[#1a1a1a]"
                          >
                            <img src={pl.images?.[0]?.url || 'https://placehold.co/48x48/282828/b3b3b3?text=🎵'} className="w-14 h-14 rounded-lg shadow-md object-cover shrink-0" alt={pl.name} />
                            <div className="flex flex-col overflow-hidden">
                              <span className="font-bold truncate text-[16px] text-white">{pl.name}</span>
                              <span className="text-[#b3b3b3] text-[13px] truncate font-medium mt-0.5">Playlist • {pl.owner?.display_name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : spotifyView === 'playlist' ? (
                      /* --- PLAYLIST / LIKED SONGS DETAIL VIEW --- */
                      <div className="space-y-1 pb-4">
                        <div className="px-4 pb-3 mb-3 border-b border-[#282828] flex justify-between items-center text-[#b3b3b3]">
                          <div className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors" onClick={() => setSpotifyView('library')}>
                            <ArrowLeft size={18} /> <span className="text-[15px] font-bold">Back</span>
                          </div>
                          {/* Optional "Play All" button for valid playlist URIs */}
                          {viewingPlaylistUri && viewingPlaylistUri !== 'liked' && (
                             <button onClick={() => setActiveSpotifyUri(viewingPlaylistUri)} className="text-[11px] font-black text-black bg-[#1DB954] hover:scale-105 transition-transform px-3 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1.5">
                                <Play size={12} fill="currentColor"/> Play All
                             </button>
                          )}
                        </div>
                        {playlistTracks.map((track, i) => (
                          <div 
                            key={`${track.id}-${i}`} 
                            onClick={() => setActiveSpotifyUri(track.uri)} 
                            className={`flex items-center gap-3.5 p-2.5 rounded-xl cursor-pointer group ${activeSpotifyUri === track.uri ? 'bg-[#282828]' : 'hover:bg-[#1a1a1a]'}`}
                          >
                            <img src={track.album?.images?.[0]?.url || 'https://placehold.co/40x40/282828/b3b3b3'} className="w-12 h-12 rounded object-cover shadow-sm shrink-0" alt={track.name} />
                            <div className="flex flex-col overflow-hidden">
                              <span className={`font-bold truncate text-[15px] ${activeSpotifyUri === track.uri ? 'text-[#1DB954]' : 'text-white'}`}>{track.name}</span>
                              <span className="text-[#b3b3b3] text-[13px] truncate mt-0.5 font-medium">{track.artists?.map(a => a.name).join(', ')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : spotifyView === 'search' ? (
                      /* --- SEARCH RESULTS VIEW --- */
                      <div className="space-y-1 pb-4">
                        <div className="px-4 pb-3 mb-3 border-b border-[#282828] flex items-center gap-2 cursor-pointer text-[#b3b3b3] hover:text-white transition-colors" onClick={() => setSpotifyView('library')}>
                          <ArrowLeft size={18} /> <span className="text-[15px] font-bold">Back to Library</span>
                        </div>
                        {searchResults.length === 0 ? (
                           <div className="text-[#b3b3b3] text-[15px] font-medium text-center mt-10">No tracks found. Try a different search!</div>
                        ) : (
                          searchResults.map(track => (
                            <div 
                              key={track.id} 
                              onClick={() => setActiveSpotifyUri(track.uri)} 
                              className={`flex items-center gap-3.5 p-2.5 rounded-xl cursor-pointer group ${activeSpotifyUri === track.uri ? 'bg-[#282828]' : 'hover:bg-[#1a1a1a]'}`}
                            >
                              <img src={track.album?.images?.[0]?.url || 'https://placehold.co/40x40/282828/b3b3b3'} className="w-12 h-12 rounded object-cover shadow-sm shrink-0" alt={track.name} />
                              <div className="flex flex-col overflow-hidden">
                                <span className={`font-bold truncate text-[15px] ${activeSpotifyUri === track.uri ? 'text-[#1DB954]' : 'text-white'}`}>{track.name}</span>
                                <span className="text-[#b3b3b3] text-[13px] truncate mt-0.5 font-medium">{track.artists?.map(a => a.name).join(', ')}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Player Iframe */}
              {activeSpotifyUri && (
                <div className="bg-[#181818] border-t border-[#282828] w-full shrink-0 z-10 shadow-[0_-10px_20px_rgb(0,0,0,0.3)] rounded-b-[2rem] overflow-hidden flex flex-col">
                  {/* Custom Track Navigation Controls */}
                  {activeSpotifyUri.includes(':track:') && (
                    <div className="flex justify-center items-center gap-8 py-2 bg-[#181818] border-b border-[#282828]">
                      <button onClick={handlePrevTrack} className="text-[#b3b3b3] hover:text-white transition-transform active:scale-95 p-1" title="Previous Track">
                        <SkipBack size={18} fill="currentColor" />
                      </button>
                      <span className="text-[10px] font-bold text-[#b3b3b3] uppercase tracking-[0.2em]">Queue</span>
                      <button onClick={handleNextTrack} className="text-[#b3b3b3] hover:text-white transition-transform active:scale-95 p-1" title="Next Track">
                        <SkipForward size={18} fill="currentColor" />
                      </button>
                    </div>
                  )}
                  <iframe 
                    src={getSpotifyEmbedUrl(activeSpotifyUri)} 
                    width="100%" 
                    height="86" 
                    frameBorder="0" 
                    allowtransparency="true" 
                    allow="encrypted-media"
                    className="block"
                  ></iframe>
                </div>
              )}
            </div>
          )}

          {/* Floating Spotify Toggle Button */}
          <button 
            onClick={() => setIsSpotifyOpen(!isSpotifyOpen)}
            className={`fixed bottom-8 left-5 md:left-8 p-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all active:scale-95 z-[110] border-4 border-[#13171A] ${isSpotifyOpen ? 'bg-[#1DB954] text-black hover:bg-[#1ed760]' : 'bg-[#181818] text-[#1DB954] hover:bg-black hover:-translate-y-1'}`}
            title="Spotify Player"
          >
            <Music size={28} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Global Style Injections (Fonts & Print Rules) */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400&display=swap');
        
        body { font-family: ui-sans-serif, system-ui, sans-serif; }
        .font-serif { font-family: 'Playfair Display', ui-serif, Georgia, Cambria, "Times New Roman", Times, serif; }

        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
          .print\\:bg-white { background-color: white !important; }
          .print\\:bg-transparent { background-color: transparent !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
          .print\\:text-black { color: black !important; }
          @page { margin: 1.5cm; }
        }
      `}} />
    </div>
  );
}