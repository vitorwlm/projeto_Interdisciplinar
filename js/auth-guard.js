import { supabase } from './config/supabaseClient.js';

const currentPage = window.location.pathname.split('/').pop().toLowerCase();
const protectedPages = new Set(['dashboard.html', 'publish.html', 'item.html']);
const publicAuthPages = new Set(['index.html', 'login.html', 'register.html']);

const loginPath = currentPage === 'index.html' ? './pages/login.html' : 'login.html';
const dashboardPath = currentPage === 'index.html' ? './pages/dashboard.html' : 'dashboard.html';

async function runAuthGuard() {
  const params = new URLSearchParams(window.location.search);
  const skipRedirect = params.get('skipRedirect') === '1' || params.has('skipRedirect');

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Erro ao verificar sessão:', error);
    return;
  }

  const session = data?.session;

  if (protectedPages.has(currentPage) && !session) {
    window.location.replace(loginPath);
    return;
  }

  if (!skipRedirect && publicAuthPages.has(currentPage) && session) {
    window.location.replace(dashboardPath);
  }
  // If skipRedirect was present in the URL, remove it for cleanliness
  if (skipRedirect) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('skipRedirect');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (e) {
      // ignore
    }
  }
}

runAuthGuard();