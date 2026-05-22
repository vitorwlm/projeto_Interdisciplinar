if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then((registration) => {
      console.log('Service Worker registrado com sucesso no escopo:', registration.scope);
    })
    .catch((error) => {
      console.log('Falha ao registrar o Service Worker:', error);
    });
}