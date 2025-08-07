import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithRedirect, getRedirectResult, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// --- Configs and Init ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : { apiKey: "DEMO", authDomain: "DEMO", projectId: "DEMO" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- MOCK DATA ---
function generateSampleQuestions(section, type) {
    return Array.from({ length: 25 }, (_, i) => ({
        id: `s${section}_q${i}`,
        text: { en: `This is ${type} question number ${i + 1} from Section ${section+1}.`, hi: `यह खंड ${section+1} से ${type} प्रश्न संख्या ${i + 1} है।` },
        options: { en: [`Option A`, `Option B`, `Option C`, `Option D`], hi: [`विकल्प क`, `ख`, `ग`, `घ`] },
        answer: `Option B`
    }));
}
const mockTestData = {
    "SSC CGL Free Mock Test": { isPremium: false, duration: 3600, sections: [ { name: "PART-A", fullName: "General Intelligence", questions: generateSampleQuestions(0, 'Free') } ] },
    "SSC CGL Premium Mock 1": { isPremium: true, duration: 3600, sections: [] }
};

// --- Global State ---
let testState = {};
let appState = { currentUser: null, currentView: 'loader' };
window.confirmationResult = null;

// --- DOM Elements ---
const viewContainer = document.getElementById('view-container');

// --- View Templates ---
const templates = {
    loader: () => `<div class="flex items-center justify-center h-full"><div class="loader"></div></div>`,
    auth: () => `
        <div class="p-8 h-full flex flex-col justify-center max-w-md mx-auto">
            <div class="text-center mb-10"><h1 class="text-4xl font-extrabold text-slate-800">Swagat Hai!</h1><p class="text-slate-500 mt-2">Apni taiyari ko nayi udaan dein.</p></div>
            <form id="login-form" class="space-y-4">
                <input type="email" id="login-email" placeholder="Email" class="w-full p-3 bg-slate-100 rounded-lg" required>
                <input type="password" id="login-password" placeholder="Password" class="w-full p-3 bg-slate-100 rounded-lg" required>
                <button type="submit" class="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700">Login with Email</button>
            </form>
        </div>`,
    mainApp: () => `
        <div id="main-content" class="h-[calc(100vh-68px)] overflow-y-auto"></div>
        <div id="bottom-nav" class="flex justify-around bg-white/80 backdrop-blur-sm border-t">
            <button data-view="dashboard" class="nav-btn p-3 flex flex-col items-center w-1/4 text-indigo-600"><span class="icon text-2xl">🏠</span><span class="text-xs font-medium">Home</span></button>
            <button data-view="tests" class="nav-btn p-3 flex flex-col items-center w-1/4 text-slate-500"><span class="icon text-2xl">📚</span><span class="text-xs font-medium">Tests</span></button>
            <button data-view="study" class="nav-btn p-3 flex flex-col items-center w-1/4 text-slate-500"><span class="icon text-2xl">📝</span><span class="text-xs font-medium">Study</span></button>
            <button data-view="profile" class="nav-btn p-3 flex flex-col items-center w-1/4 text-slate-500"><span class="icon text-2xl">👤</span><span class="text-xs font-medium">Profile</span></button>
        </div>
    `,
    dashboard: () => `
        <div class="p-6 bg-slate-50 h-full">
            <div class="mb-8">
                <p class="text-slate-500">Namaste!</p>
                <h1 class="text-3xl font-bold text-slate-800">${appState.currentUser?.displayName || 'Student'}</h1>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="p-6 bg-white rounded-lg shadow-sm hover:shadow-lg transition-shadow cursor-pointer" onclick="window.showView('tests')">
                    <span class="text-4xl">📚</span><h2 class="font-bold text-indigo-800 text-xl mt-2">Mock Tests</h2><p class="text-sm text-slate-600">Asli exam pattern par practice karein.</p>
                </div>
                <div class="p-6 bg-white rounded-lg shadow-sm hover:shadow-lg transition-shadow cursor-pointer" onclick="window.showView('study')">
                    <span class="text-4xl">📝</span><h2 class="font-bold text-indigo-800 text-xl mt-2">AI Study Notes</h2><p class="text-sm text-slate-600">Kisi bhi topic par notes banayein.</p>
                </div>
            </div>
        </div>`,
    tests: () => `...`, // Test list view
    study: () => `...`, // AI Notes view
    profile: () => `...`, // Profile view
    premium: () => `...`, // Premium page
    instructions: (testName) => `...`, // Instructions template
    test: (testName) => `...`, // Test template
    result: (resultData) => `...` // Result template
};

// --- View Manager ---
function renderView(view, data = {}) {
    appState.currentView = view;
    if (templates[view]) {
        viewContainer.innerHTML = templates[view](data);
        bindEventListeners();
    }
}

function bindEventListeners() {
    document.getElementById('login-form')?.addEventListener('submit', handleEmailLogin);
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = (e) => {
            const viewName = e.currentTarget.dataset.view;
            window.showView(viewName);
        };
    });
}

window.showView = (viewName) => {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) {
        renderView('mainApp');
        setTimeout(() => window.showView(viewName), 0);
        return;
    }
    const viewContent = {
        'dashboard': templates.dashboard(),
        'tests': templates.tests(),
        'study': '<div>Study Notes (Coming Soon)</div>',
        'profile': '<div>Profile (Coming Soon)</div>',
    };
    mainContent.innerHTML = viewContent[viewName];
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('text-indigo-600', btn.dataset.view === viewName);
        btn.classList.toggle('text-slate-500', btn.dataset.view !== viewName);
    });
}

// --- Auth Logic ---
function handleEmailLogin(e) {
    e.preventDefault();
    appState.currentUser = { displayName: document.getElementById('login-email').value.split('@')[0] };
    renderView('mainApp');
    showView('dashboard');
}

// --- Initial Load ---
renderView('loader');
setTimeout(() => {
    renderView('auth');
}, 1000);
