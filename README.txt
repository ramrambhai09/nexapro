nexapro mobile update

Updated:
- Mobile layout is smaller and cleaner.
- Header/topbar auto hides when scrolling down on mobile and comes back when scrolling up.
- Phone preview is smaller on mobile.
- Uploaded portrait images still show fully without crop.
- Copy Prompt now shows button pulse + center “Prompt Copied” animation.
- Supabase database, storage, auth code is kept same.
- Hidden admin opens after clicking nexapro brand 4 times.

Upload these files to Netlify:
- index.html
- style.css
- app.js

New animation update:
- Copy Prompt now launches attractive flying ribbon/confetti animation.
- Center copied popup now has ring burst animation.

Sound update:
- Copy Prompt now plays a short attractive sparkle/chime sound using browser Web Audio.
- No external audio file is needed.
- Sound plays only after user click, so mobile browsers allow it.

Cartoon toy whistle update:
- Copy Prompt now plays cartoon toy whistle style sound.
- Copy animation now includes stars, bubbles, spark sticks, ribbons and confetti.

Instagram + scroll sound update:
- Added glowing Instagram link above Viral 3D Prompt Platform.
- Current link is https://www.instagram.com/nexapro.ai ; change it in index.html later.
- Added soft dub-dub sound while scrolling/touch moving on mobile.

Male/Female filter update:
- Removed dynamic All Categories behavior.
- Gallery filter now has All Prompts, Male, Female.
- Admin panel now uses Select Prompt Type: Male or Female.
- Saved data still uses the existing category column, so no new database table/column is required.
- If All Prompts is selected, all cards are visible. If Male/Female is selected, only that type is visible.

Pagination update:
- After 10 containers, pagination appears: ‹ 1 2 3 ›.
- Each page shows 10 prompt containers.
- Page change has smooth card reveal animation.
- Male/Female/All filter now has spark animation and card reveal.

AdSense verification update:
- Added meta tag in <head>:
  <meta name="google-adsense-account" content="ca-pub-6736985925406459">

AdSense ads.txt update:
- Added ads.txt at root.
- Added Auto Ads script in index.html head.
- ads.txt line: google.com, pub-6736985925406459, DIRECT, f08c47fec0942fa0

Live views counter update:
- Added live visit counter beside Explore Prompts.
- Every page load/visit increments count by 1.
- Multiple visits/reloads from same device also count.
- Count is stored in Supabase table site_views.
- Run supabase-live-views.sql once in Supabase SQL Editor.
- Realtime subscription updates the count for all users.

Live views working fix:
- Fixed startup call location. Counter now increments immediately when site loads.
- Run supabase-live-views.sql if not already run.

Important notice bar update:
- Added red glowing moving notice bar below the header/logo.
- Text moves from right to left.
- Admin can save/update/delete notice text.
- Run supabase-important-notice.sql once in Supabase SQL Editor.

AI tools update:
- Added tools section below stats containers.
- Admin can add/update/delete tool name, icon and URL.
- Run supabase-ai-tools.sql once in Supabase SQL Editor.

Tools marquee update:
- Tools section now stays in one row only.
- Tools move horizontally in a compact marquee, so they do not take extra page space.
- Hover pauses the tools movement.

Full SEO update:
- Added SEO title, description, canonical URL, OG/Twitter tags and JSON-LD.
- Added visible AI prompt keyword content box above gallery.
- Added floating right-side Instagram icon.
- Added robots.txt, sitemap.xml, and Google Search Console verification HTML file.
