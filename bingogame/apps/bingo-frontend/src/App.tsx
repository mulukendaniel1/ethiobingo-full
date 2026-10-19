// apps/bingo-frontend/src/App.tsx
import { Router, Route } from '@solidjs/router';
import { createSignal, onMount, onCleanup } from 'solid-js';
import { jwtDecode } from 'jwt-decode';
import GameCanvas from './components/GameCanvas';
import { showToast } from './components/Toast';
import WelcomeOverlay from './components/WelcomeOverlay';
import ToastContainer from './components/Toast';

function App() {
  onMount(() => {
    // 1. Theme initialization: default to dark if no saved preference
    const savedTheme = localStorage.getItem('theme');
    const root = document.documentElement;
    if (savedTheme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }

    // 2. Token handshake
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      try {
        const decoded: any = jwtDecode(tokenFromUrl);
        if (decoded.exp * 1000 < Date.now()) {
          showToast("This entry link has expired. Please request a new one.", "error", 6000);
          localStorage.removeItem('etm_token');
        } else {
          localStorage.setItem('etm_token', tokenFromUrl);
          showToast("Secure session established", "success", 3000);
        }
      } catch (e) {
        showToast("Invalid security token provided.", "error", 5000);
      }
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    // 3. Network checks
    let isFirstCheck = true;
    const handleOnlineFirst = () => {
      if (isFirstCheck) return;
      showToast("Back online!", "success");
    };
    const handleOfflineFirst = () => {
      isFirstCheck = false;
      showToast("Check your connection", "error");
    };
    window.addEventListener('online', handleOnlineFirst);
    window.addEventListener('offline', handleOfflineFirst);
    setTimeout(() => { isFirstCheck = false; }, 2000);

    let isInitialLoad = true;
    const handleOnline = () => {
      if (isInitialLoad) return;
      showToast("Network restored. Reconnecting...", "success", 3000);
    };
    const handleOffline = () => {
      isInitialLoad = false;
      showToast("Connection lost. Working offline.", "error", 5000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setTimeout(() => { isInitialLoad = false; }, 1000);

    onCleanup(() => {
      window.removeEventListener('online', handleOnlineFirst);
      window.removeEventListener('offline', handleOfflineFirst);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    });
  });

  return (
    <div class="min-h-screen font-inter select-none touch-none">
      <ToastContainer />
      {/* Always rendered — WelcomeOverlay manages its own visibility internally */}
      <WelcomeOverlay />
      <Router>
        <Route path="/" component={GameCanvas} />
      </Router>
    </div>
  );
}

export default App;