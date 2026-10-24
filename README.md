# TSK – The Spice Kitchen, Kokapet

Website for TSK – The Spice Kitchen, a Telugu restaurant on Gandipet Main Road, Kokapet, Hyderabad.

- Order online: TSK on the Ownly app, https://ownly.food/app/brand/BR443647
- WhatsApp (table bookings and catering): +91 93986 93051
- Calls: +91 99490 51777
- Address: Ground Floor, Shop No. 9 & 10, Raichandani Business Bay, Gandipet Main Road, Kokapet, Hyderabad, Telangana 500075
- Open every day, 11 AM – 11 PM

## How the page is built

The whole page is one file, `index.html` (styles and scripts are inside it). Its design idea is "every arch, a feast": the
main hall frames painted Telugu feasts in arches, so the page frames the food the same way. Maroon and rice white with
turmeric gold, taken from the logo.

| Folder | What's in it |
|---|---|
| `img/` | Photos used by the design (the hero feast, the seven signatures, the dining rooms, catering), cropped and compressed as WebP. They come from the restaurant's Google Drive folders TSK-FOOD and TSK-AMBIENCE. |
| `assets/` | Older dish photos the menu still uses for a few dishes. |
| `fonts/` | Fraunces (headings), Manrope (text) and Tiro Telugu (the Telugu lines, cut down to the letters the page uses). If you add new Telugu text, the Telugu font needs those letters added too. |
| `js/` | GSAP, ScrollTrigger and Lenis for the scrolling effects. The page works without them, just without motion. |

The menu loads from the "TSK Website Menu" Google Sheet (https://docs.google.com/spreadsheets/d/1VEYV7BGNcUGx93y3vQiiTNAgh97ABuqoGu65xQgBMzc/edit) each time the page opens, and menu dish photos load from Google Drive through the sheet's photo column. Edit the sheet to change dishes, prices and photos; its "How to edit" tab explains how. If the sheet can't be read, the page uses the last copy the visitor's browser saw, then the menu built into index.html. The hero line "160+ more dishes" counts the dishes on the live menu by itself.

Online orders go through Ownly. Visitors add dishes to the order on this page, then "Order on Ownly" opens TSK in the Ownly app (or the app store if it isn't installed). Ownly's link only takes the restaurant, not a filled cart, so after the tap the website order turns into a checklist the customer ticks off while adding the same dishes in Ownly; on a computer it also shows a QR code to open Ownly on a phone. The Ownly link is the `OWNLY` constant near the top of the main script in `index.html` (also used in the order buttons); if Ownly ever offers a pre-filled cart link, build it in `ownlyHref()` there. Table bookings and catering open WhatsApp on +91 93986 93051.
