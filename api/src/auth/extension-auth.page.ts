export function renderExtensionAuthPage(mode: 'signin' | 'signup'): string {
  const isSignup = mode === 'signup';
  const title = isSignup ? 'Create account' : 'Sign in';
  const submitLabel = isSignup ? 'Create account' : 'Sign in';
  const toggleMode = isSignup ? 'signin' : 'signup';
  const toggleLabel = isSignup ? 'Already have an account? Sign in' : 'Need an account? Sign up';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LI Facilitator – ${title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0a66c2 0%, #004182 100%);
      color: #1f2937;
    }
    .card {
      width: 100%;
      max-width: 400px;
      margin: 1rem;
      background: #fff;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    }
    h1 { margin: 0 0 0.25rem; font-size: 1.5rem; }
    .subtitle { margin: 0 0 1.5rem; color: #6b7280; font-size: 0.95rem; }
    .notice {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      margin-bottom: 1.25rem;
      font-size: 0.875rem;
    }
    label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.35rem; }
    input {
      width: 100%;
      padding: 0.65rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 1rem;
      margin-bottom: 1rem;
    }
    input:focus { outline: 2px solid #0a66c2; border-color: #0a66c2; }
    button[type="submit"] {
      width: 100%;
      padding: 0.75rem;
      border: none;
      border-radius: 8px;
      background: #0a66c2;
      color: #fff;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }
    button[type="submit"]:disabled { opacity: 0.6; cursor: not-allowed; }
    .error {
      color: #b91c1c;
      font-size: 0.875rem;
      margin-bottom: 1rem;
      display: none;
    }
    .success {
      color: #047857;
      font-size: 0.95rem;
      display: none;
      text-align: center;
    }
    .toggle {
      display: block;
      margin-top: 1.25rem;
      text-align: center;
      color: #0a66c2;
      text-decoration: none;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p class="subtitle">Connect your Chrome extension</p>
    <div class="notice">Sign in to sync the LI Facilitator extension with your account.</div>

    <form id="auth-form">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" required autocomplete="email" placeholder="you@example.com" />

      <label for="password">Password</label>
      <input id="password" name="password" type="password" required minlength="6" autocomplete="${isSignup ? 'new-password' : 'current-password'}" placeholder="Min. 6 characters" />

      <p id="error" class="error"></p>
      <p id="success" class="success"></p>

      <button id="submit" type="submit">${submitLabel}</button>
    </form>

    <a class="toggle" href="/auth?source=extension&mode=${toggleMode}">${toggleLabel}</a>
  </div>

  <script>
    const form = document.getElementById('auth-form');
    const errorEl = document.getElementById('error');
    const successEl = document.getElementById('success');
    const submitBtn = document.getElementById('submit');
    const isSignup = ${isSignup ? 'true' : 'false'};

    function showError(message) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
      successEl.style.display = 'none';
    }

    function showSuccess(message) {
      successEl.textContent = message;
      successEl.style.display = 'block';
      errorEl.style.display = 'none';
      form.style.display = 'none';
    }

    function syncToExtension(token, email) {
      localStorage.setItem('li_facilitator_token', token);
      localStorage.setItem('li_facilitator_email', email || '');

      window.postMessage(
        { type: 'LI_FACILITATOR_AUTH', token, email: email || '' },
        window.location.origin,
      );
      window.dispatchEvent(new CustomEvent('li-facilitator-auth-sync'));
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorEl.style.display = 'none';
      submitBtn.disabled = true;

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const endpoint = isSignup ? '/auth/register' : '/auth/login';

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || 'Authentication failed');
        }

        if (isSignup) {
          syncToExtension(data.accessToken, data.user?.email || email);
          showSuccess('Account created and signed in! You can close this tab and return to LinkedIn.');
          return;
        }

        syncToExtension(data.accessToken, data.user?.email || email);
        showSuccess('Signed in! You can close this tab and return to LinkedIn.');
      } catch (err) {
        showError(err.message || 'Something went wrong');
        submitBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}
