import { supabase } from './config/supabaseClient.js';
console.log("O ficheiro auth.js está a carregar com sucesso!");

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const campus = document.getElementById('campus').value;
            const password = document.getElementById('password').value;

            const submitBtn = registerForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'A criar conta...';

            try {
                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            full_name: name
                            // campus removed from metadata
                        }
                    }
                });

                if (error) throw error;

                // save university to utilizador table after trigger creates the row
                const { error: updateError } = await supabase
                    .from('utilizador')
                    .update({ university: campus })
                    .eq('id', data.user.id);

                if (updateError) throw updateError;

                // show success message without alert()
                const msg = document.createElement('div');
                msg.className = 'notification is-success';
                msg.textContent = 'Conta criada! Verifica o teu e-mail para confirmares o registo.';
                registerForm.prepend(msg);

                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);

            } catch (error) {
                console.error('Erro detalhado do Supabase:', error.message);
                alert('Não foi possível criar a conta: ' + error.message);
            } finally {
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

                if (error) throw error;

                // removed alert() — redirect is enough
                window.location.href = 'dashboard.html';

            } catch (error) {
                console.error('Erro detalhado do Supabase:', error.message);
                alert('Não foi possível iniciar sessão: ' + error.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Entrar';
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // changed from 'user' to 'logout-btn'
    const logoutBtn = document.getElementById('logout-btn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            try {
                const { error } = await supabase.auth.signOut({ scope: 'local' });

                if (error) throw error;

                window.location.href = '../index.html';

            } catch (error) {
                console.error('Erro detalhado do Supabase:', error.message);
                alert('Não foi possível terminar a sessão: ' + error.message);
            }
        });
    }
});