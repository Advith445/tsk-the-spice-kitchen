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
