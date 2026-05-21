import { supabase } from './config/supabaseClient.js';
console.log("O ficheiro auth.js está a carregar com sucesso!");

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            // Impede o comportamento padrão do formulário (recarregar a página)
            e.preventDefault();

            // Captura os valores dos inputs do HTML
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const campus = document.getElementById('campus').value;
            const password = document.getElementById('password').value;

            // Desativa o botão temporariamente para evitar múltiplos cliques
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'A criar conta...';

            try {
                // Executa o registo no Supabase Auth
                // Usamos o 'options.data' para guardar dados extra (metadados) que não sejam apenas e-mail/password
                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            full_name: name,
                            campus: campus
                        }
                    }
                });

                if (error) {
                    throw error;
                }

                // Sucesso no registo
                alert('Conta criada com sucesso! Por favor, verifica a caixa de entrada do teu e-mail para confirmar o registo.');

                // Redireciona o utilizador para a página de login
                window.location.href = 'login.html';

            } catch (error) {
                // Trata possíveis erros (ex: e-mail já registado, password fraca, etc.)
                console.error('Erro detalhado do Supabase:', error.message);
                alert('Não foi possível criar a conta: ' + error.message);
            } finally {
                // Reativa o botão caso ocorra um erro e o utilizador precise de tentar novamente
                submitBtn.disabled = false;
                submitBtn.textContent = 'Criar Conta';
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'A Entrar...';

            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password,
                });

                if (error) {
                    throw error;
                }

                // Sucesso no login
                alert('Sessão iniciada com sucesso!');
                window.location.href = 'dashboard.html';

            } catch (error) {
                console.error('Erro detalhado do Supabase:', error.message);
                alert('Não foi possível iniciar sessão: ' + error.message);
            } finally {
                // Reativa o botão caso ocorra um erro
                submitBtn.disabled = false;
                submitBtn.textContent = 'Entrar';
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('user');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            try {
                const { error } = await supabase.auth.signOut({ scope: 'local' });

                if (error) {
                    throw error;
                }

                // Sucesso no logout — redireciona para a página inicial
                window.location.href = '../index.html';

            } catch (error) {
                console.error('Erro detalhado do Supabase:', error.message);
                alert('Não foi possível terminar a sessão: ' + error.message);
            }
        });
    }
});