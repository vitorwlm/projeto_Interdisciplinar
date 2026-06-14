/*
 * auth.js (página) — Ponto de entrada das páginas de autenticação.
 *
 * Este ficheiro é importado por login.html E register.html.
 * Cada função (initLoginForm / initRegisterForm) começa por verificar
 * se o seu formulário existe na página — se não existir, não faz nada.
 * Assim, o mesmo script serve as duas páginas sem erros.
 *
 * O initPage() garante que:
 *   • O Service Worker é registado.
 *   • Se o utilizador já tiver sessão, é redirecionado para o dashboard
 *     (não faz sentido estar no login estando autenticado).
 */

import { initPage } from '../utils/utils.js';
import { initLoginForm, initRegisterForm } from '../auth/auth.js';

await initPage();
initLoginForm();
initRegisterForm();
