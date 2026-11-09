# TSK – The Spice Kitchen, Kokapet

Website for TSK – The Spice Kitchen, a Telugu restaurant on Gandipet Main Road, Kokapet, Hyderabad.

- Order online: TSK on the Ownly app, https://ownly.food/app/brand/BR443647
- WhatsApp (table bookings and catering): +91 93986 93051
- Calls: +91 99490 51777
- Address: Ground Floor, Shop No. 9 & 10, Raichandani Business Bay, Gandipet Main Road, Kokapet, Hyderabad, Telangana 500075
- Open every day, 11 AM – 11 PM

The whole site is one file, `index.html`. Dish and dining-room photos load from the restaurant's Google Drive folder, and the menu loads from the "TSK Website Menu" Google Sheet (https://docs.google.com/spreadsheets/d/1VEYV7BGNcUGx93y3vQiiTNAgh97ABuqoGu65xQgBMzc/edit) each time the page opens. Edit the sheet to change dishes, prices and photos; its "How to edit" tab explains how. If the sheet can't be read, the page uses the last copy the visitor's browser saw, then the menu built into index.html.

Online orders go through Ownly. Visitors add dishes to the order on this page, then "Order on Ownly" opens TSK in the Ownly app (or the app store if it isn't installed). Ownly's link only takes the restaurant, not a filled cart, so after the tap the website order turns into a checklist the customer ticks off while adding the same dishes in Ownly; on a computer it also shows a QR code to open Ownly on a phone. The Ownly link is the `OWNLY` constant near the top of the main script in `index.html` (also used in the order buttons); if Ownly ever offers a pre-filled cart link, build it in `ownlyHref()` there. Table bookings, catering and the Diwali preorder enquiry still open WhatsApp on +91 93986 93051.

The Diwali preorder section (`#diwali-preorders` in `index.html`, styled by the `tskd-css` block in the page head, run by `diwali.js`) sits below the hero. Guests pick from five dishes, add a special request and send a prefilled WhatsApp enquiry. It removes itself from 9 November 2026: change `data-ends` on the section to keep it longer, or delete the section, the style block and the `diwali.js` script tag to take it down. To change a dish, edit its card in the section (name in `data-name`, photo, kicker).

The catering pop-up (`#catering-popup` near the end of `index.html`, styled by `catering-popup.css`, run by `catering-popup.js`) slides up on phones 3 seconds after the page opens, on every visit, and "See catering options" takes them to the catering section. If the visitor's finger is on the screen or they are typing at that moment, it waits until they are done; it is skipped for visitors who arrive on the catering section through a #catering link. To preview it on a computer, open the site with `?popup` at the end (for example tskthespicekitchenkokapet.in/?popup). The settings at the top of `catering-popup.js` change the delay (`DELAY_S`) and whether computers see it too (`SHOW_ON`). Edit the words in the dialog in `index.html`. To take it down, delete the dialog, the `catering-popup.css` link in the page head and the `catering-popup.js` script tag.

## Blog: "From Our Kitchen"

Posts are written in the blog editor, [Pages CMS](https://app.pagescms.org), which edits this repository. The editor's settings are in `.pages.yml`.

- **Where things live.** Posts are `_blog/posts/<web-address>.md`; photos uploaded in the editor go to `_blog/media/`. Folders starting with an underscore are not served by GitHub Pages, so only the finished pages are public.
- **What happens when a post is saved.** `.github/workflows/build-blog.yml` runs `_tools/build-blog.mjs`. It writes one page per published post at `/blog/<web-address>/`, the list at `/blog/`, resized copies of the photos in `blog/img/`, the share image for WhatsApp, the three newest posts as cards between the `BLOG:START` and `BLOG:END` markers in `index.html` (just above the FAQs), the "Stories" link in the top menu and the side panel (the `BLOG-NAV` and `BLOG-SHEET` markers; it only exists while at least one post is published), and the blog entries in `sitemap.xml`. Then it commits the result. Don't edit `blog/`, the block between the markers, or the blog lines of `sitemap.xml` by hand; the next save replaces them.
- **Published switch.** A post only goes on the site while its "Published" switch is on. New posts start switched off, so a half-written post can't go live. With no published posts, the homepage section, `/blog/` and the sitemap entries all disappear.
- **Videos.** A YouTube (or Instagram) link in the "Video" box shows at the end of the post; a link on a line of its own in the story shows where it is. Nothing loads from YouTube or Instagram until the visitor presses play, so the privacy policy stays accurate.
- **Look.** Styles for the blog pages and the homepage cards are in `_tools/blog.css` (copied to `blog/blog.css` by the build). The post layout is in `_tools/build-blog.mjs`.
- **Run it yourself.** `cd _tools && npm ci && node build-blog.mjs`. The build is repeatable: running it twice gives identical files.
- **Public repository.** Anyone can read this repository, including posts that are switched off. Don't put anything private in a draft.

## Menu page: /menu/

A plain, fast page with every dish, option and price, built from the same "TSK Website Menu" Google Sheet as the homepage menu. Search engines and the Google Business Profile can read it without running any scripts.

- **Where things live.** `.github/workflows/build-menu.yml` runs `_tools/build-menu.mjs`, which writes `menu/index.html`, `menu/menu.css` (a copy of `_tools/menu.css`) and the `/menu/` entry in `sitemap.xml`. Don't edit those by hand; the next run replaces them.
- **Where it is linked.** From the homepage ("See the full menu on one page" under the menu, and the footer), from the header and footer of every blog page (`_tools/build-blog.mjs`), and from the homepage's structured data (`hasMenu`). The page's own header links back to the homepage and the blog.
- **When it updates.** Every 30 minutes (GitHub can start a run a few minutes late), whenever the builder itself changes, and on demand: Actions tab → "Build menu" → "Run workflow". After you edit the sheet, press "Run workflow" for an immediate update, or just wait for the next run.
- **What the page shows.** Sections in the order of the sheet's "Sections" tab, with "Popular" dishes first (only those get photos). Rows with "On website" switched off are left out. Each dish shows its options, prices in ₹ and a Veg / Egg / Non-veg mark that is also written in words. The page also carries the same menu as structured data (JSON-LD) for Google.
- **Safety checks.** The page is only replaced when the sheet passes these checks: every visible row has a Section, a Dish name, a Type (Veg, Egg or Non-veg) and a price that is a number, the sheet has at least 30 dishes, and it has not lost more than 20% of the dishes on the live page. If a check fails, the live page is left alone, the run turns red, and GitHub emails the account that last changed the schedule. Open the failed run, then the "Build the menu page" step: it names the row to fix. The next run picks up the fix by itself.
- **Removing many dishes on purpose.** If you really cut the menu by more than 20%, press "Run workflow" and tick "Publish even if the menu lost more than 20% of its dishes".
- **Not covered.** The built-in backup menu inside `index.html` (shown only when the sheet can't be read) is not refreshed by this job.
- **Quiet repository.** GitHub switches scheduled runs off in a public repository after 60 days without any activity. If nothing has been saved for 45 days, the job adds an empty "Keep the 30-minute menu refresh switched on" note so the schedule keeps running.
- **Look.** Styles are in `_tools/menu.css`, the page layout in `_tools/build-menu.mjs`. `cd _tools && npm test` runs the builder's checks. To build it yourself: `cd _tools && node build-menu.mjs` (needs internet access to Google Sheets). Running it twice gives identical files.
