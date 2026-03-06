import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dúnedain — Privacy Policy</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a; color: #e0e0e0;
      line-height: 1.7; padding: 2rem 1rem;
    }
    .container { max-width: 720px; margin: 0 auto; }
    h1 { font-size: 1.8rem; margin-bottom: 0.25rem; color: #fff; }
    .subtitle { color: #888; margin-bottom: 2rem; font-size: 0.95rem; }
    h2 { font-size: 1.15rem; color: #fff; margin: 1.8rem 0 0.6rem; }
    p, li { font-size: 0.95rem; color: #ccc; }
    ul { padding-left: 1.25rem; margin: 0.5rem 0; }
    li { margin-bottom: 0.35rem; }
    a { color: #7eb8ff; }
    .footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid #222; color: #666; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Dúnedain — Privacy Policy</h1>
    <p class="subtitle">Last updated: March 6, 2026</p>

    <h2>1. What We Are</h2>
    <p>Dúnedain is a personal fitness tracking application that integrates with third-party services, including Whoop, to help you visualize your training, recovery, and wellness data.</p>

    <h2>2. Data We Collect</h2>
    <p>When you connect your Whoop account, we access the following data through the Whoop API:</p>
    <ul>
      <li><strong>Recovery data</strong> — recovery score, HRV, resting heart rate</li>
      <li><strong>Sleep data</strong> — sleep stages, duration, sleep score</li>
      <li><strong>Strain data</strong> — daily strain score, calories</li>
      <li><strong>Workout data</strong> — workout type, strain, duration</li>
      <li><strong>Profile data</strong> — basic profile and body measurements</li>
    </ul>
    <p>We also store authentication tokens required to maintain your Whoop connection.</p>

    <h2>3. How We Use Your Data</h2>
    <p>Your data is used exclusively to:</p>
    <ul>
      <li>Display your fitness and recovery metrics within the app</li>
      <li>Generate visualizations and trend analysis for your personal use</li>
      <li>Cache data locally to reduce API calls and improve performance</li>
    </ul>
    <p>We do <strong>not</strong> sell, share, or distribute your data to any third parties.</p>

    <h2>4. Data Storage &amp; Security</h2>
    <p>Your data is stored in a secured Supabase database with row-level security (RLS) enabled. Only you can access your own data. Authentication tokens are stored encrypted and are never exposed to the frontend.</p>

    <h2>5. Data Retention</h2>
    <p>Your data is retained for as long as your account is active. You can disconnect your Whoop account at any time, which will delete your stored Whoop tokens and cached data.</p>

    <h2>6. Your Rights</h2>
    <p>You have the right to:</p>
    <ul>
      <li><strong>Access</strong> — View all data we have stored about you</li>
      <li><strong>Delete</strong> — Request deletion of all your data at any time</li>
      <li><strong>Disconnect</strong> — Revoke Whoop access and remove stored tokens</li>
      <li><strong>Export</strong> — Request a copy of your data in a portable format</li>
    </ul>

    <h2>7. Third-Party Services</h2>
    <p>We integrate with:</p>
    <ul>
      <li><strong>Whoop</strong> — for fitness/recovery data (<a href="https://www.whoop.com/privacy/" target="_blank">Whoop Privacy Policy</a>)</li>
      <li><strong>Supabase</strong> — for authentication and data storage (<a href="https://supabase.com/privacy" target="_blank">Supabase Privacy Policy</a>)</li>
    </ul>

    <h2>8. Changes to This Policy</h2>
    <p>We may update this policy from time to time. Changes will be reflected by the "Last updated" date above.</p>

    <h2>9. Contact</h2>
    <p>Questions about this policy? Reach out at <a href="mailto:bigbrotherclaw@gmail.com">bigbrotherclaw@gmail.com</a>.</p>

    <div class="footer">
      <p>&copy; 2026 Dúnedain. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

serve(() => {
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
