/*
 * sw-register.js — Registo centralizado do Service Worker.
 *
 * O que é um Service Worker?
 *   É um script que corre num thread separado do browser, entre a aplicação
 *   e a rede. Permite que a app funcione offline e carregue mais depressa,
 *   porque os assets (HTML, CSS, JS) são servidos da cache local em vez
 *   de serem descarregados do servidor em cada visita.
 *
 * Porquê um ficheiro separado para o registo?
 *   O Service Worker tem de ser registado em todas as páginas da app.
 *   Centralizar aqui garante que basta importar este módulo em cada
 *   página — se a lógica mudar, só se altera num sítio.
 */

export function registerServiceWorker() {
  /*
   * Verificação de suporte: browsers antigos não têm serviceWorker.
   * O "return" imediato faz a app continuar a funcionar normalmente
   * sem SW — degradação elegante (graceful degradation).
   */
  if (!('serviceWorker' in navigator)) return;

  /*
   * O registo é feito no evento "load" (após o carregamento completo da página)
   * para não competir com recursos críticos e atrasar a renderização inicial.
   * O SW regista-se em segundo plano quando a página já está visível.
   */
  window.addEventListener('load', () => {
    /*
     * O caminho '/sw.js' é absoluto (começa com '/') para que o Service Worker
     * tenha escopo sobre toda a app, independentemente da página onde é
     * registado (raiz ou pasta /pages/).
     */
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registado com escopo:', registration.scope);
      })
      .catch((error) => {
        console.error('Erro ao registar o Service Worker:', error);
      });
  });
}
