/*
 * auth.js — Lógica dos formulários de registo e login.
 *
 * Este módulo exporta duas funções independentes (initRegisterForm e
 * initLoginForm) que são chamadas pela página correspondente.
 * Separar a lógica de autenticação do HTML garante que o mesmo código
 * pode ser reutilizado sem duplicação.
 */

import { supabase } from '../config/supabaseClient.js';
import { showAlert } from '../utils/utils.js';

/*
 * safeReturnUrl — Decide para onde enviar o utilizador após o login.
 *
 * Recebe o valor bruto do parâmetro "returnUrl" (pode vir null ou
 * codificado, ex.: "edit.html%3Fid%3D123") e devolve um destino seguro.
 *
 * Porquê validar?
 *   Redirecionar cegamente para um valor vindo do URL permitiria um
 *   "open redirect" — um atacante podia construir
 *   "login.html?returnUrl=https://site-malicioso.com" e enviar a vítima
 *   para fora da app após o login. Por isso só aceitamos caminhos
 *   relativos internos; qualquer outra coisa cai no dashboard.
 */
function safeReturnUrl(raw) {
  const fallback = 'dashboard.html';
  if (!raw) return fallback;

  let value;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return fallback;
  }

  /*
   * Rejeita destinos externos ou absolutos:
   *   • "http://" / "https://"  → outro site
   *   • "//site.com"            → protocolo-relativo (também externo)
   *   • "/algo"                 → sai do diretório /pages/
   *   • contém ":"              → esquemas como javascript: ou mailto:
   */
  if (/^https?:/i.test(value) || value.startsWith('//') || value.startsWith('/') || value.includes(':')) {
    return fallback;
  }

  return value;
}

/*
 * initRegisterForm — Ativa o formulário de criação de conta.
 *
 * Porquê verificar se o formulário existe antes de ligar o evento?
 *   Este ficheiro é importado tanto pela página de login como pela de registo.
 *   O getElementById devolve null se o elemento não existir, por isso o "return"
 *   evita erros quando a função é chamada na página errada.
 */
export function initRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    /*
     * e.preventDefault() impede o comportamento padrão do formulário HTML
     * (recarregar a página com GET/POST), para podermos tratar o submit
     * com JavaScript assíncrono.
     */
    e.preventDefault();

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const university = document.getElementById('university').value;
    const password = document.getElementById('password').value;

    /*
     * Desativar o botão durante o pedido evita que o utilizador carregue
     * várias vezes e crie contas duplicadas enquanto espera pela resposta.
     */
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'A criar conta...';

    try {
      /*
       * supabase.auth.signUp cria a conta de autenticação (email + password).
       * O campo "options.data" passa metadados que ficam associados ao token
       * JWT — usamos para guardar o nome antes de ter o ID da base de dados.
       */
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } }
      });

      if (error) throw error;

      /*
       * O Supabase cria automaticamente o utilizador na tabela "auth.users",
       * mas precisamos de guardar dados extra (nome, universidade) na nossa
       * tabela "utilizador". O upsert (INSERT + UPDATE) garante que não
       * há conflito mesmo que o registo já exista.
       */
      const profileResult = await supabase
        .from('utilizador')
        .upsert({ id: data.user.id, name, email, university });

      if (profileResult.error) throw profileResult.error;

      showAlert(form, 'success', 'Conta criada com sucesso! A entrar...');

      /*
       * O registo já deixa o utilizador com sessão iniciada, por isso enviamo-lo
       * diretamente para o dashboard. Esperamos 1,5 segundos para ele conseguir
       * ler a mensagem de sucesso antes do redirecionamento.
       */
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
    } catch (err) {
      console.error('Erro:', err.message);
      showAlert(form, 'danger', 'Não foi possível criar a conta: ' + err.message);
    } finally {
      /*
       * O bloco "finally" corre sempre — com sucesso ou erro — para garantir
       * que o botão é reativado e o utilizador pode tentar novamente.
       */
      submitBtn.disabled = false;
      submitBtn.textContent = 'Criar Conta';
    }
  });
}

/*
 * initLoginForm — Ativa o formulário de autenticação.
 *
 * Usa signInWithPassword que verifica as credenciais no Supabase Auth
 * e, em caso de sucesso, guarda um token JWT em localStorage para
 * manter a sessão entre páginas.
 */
export function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'A Entrar...';

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      /*
       * Algumas páginas protegidas (ex.: edit.html, admin.html) enviam o
       * utilizador para o login com "?returnUrl=...". Depois de autenticar,
       * voltamos a essa página em vez de ir sempre para o dashboard.
       *
       * safeReturnUrl valida o destino para evitar "open redirects": só
       * aceitamos caminhos relativos internos (sem esquema http(s):, sem
       * "//" protocolo-relativo e sem "/" inicial que sairia do diretório).
       */
      const destino = safeReturnUrl(
        new URLSearchParams(window.location.search).get('returnUrl')
      );

      /*
       * window.location.replace (em vez de href) substitui a entrada no
       * histórico do browser — o utilizador não consegue voltar à página
       * de login carregando "Recuar", o que é o comportamento esperado.
       */
      window.location.replace(destino);
    } catch (err) {
      console.error('Erro:', err.message);
      /*
       * Mensagem genérica intencional: não indicar se foi o e-mail ou a
       * password que falhou evita revelar quais contas existem no sistema.
       */
      showAlert(form, 'danger', 'E-mail ou password incorretos.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Entrar';
    }
  });
}
