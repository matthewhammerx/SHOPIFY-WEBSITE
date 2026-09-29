# LiverWell milk thistle product page: setup

This is a custom product page built in the Resilia layout. Every section is prefixed **"LW ·"** in the theme editor, and every text, image, color and block on it can be edited.

## 1. Upload and assign
1. Zip the repo (or connect it through Shopify's GitHub integration) and upload it under **Online Store → Themes**.
2. Create the product, then open **Theme template** in the product admin and pick **`milk-thistle`**.
3. Your header, footer, announcement bar and **cart drawer are the theme's own, unchanged**. The new Add to Cart button opens your existing drawer.

## 2. Product variants (so prices always match checkout)
The bundle cards read their price from real variants:

| Offer card | Variant position | Example price | Compare-at |
|---|---|---|---|
| Buy 3 Get 2 Free Gifts | 3 | $89.97 | $179.97 |
| Buy 2 Get 1 Free Gift (default) | 2 | $69.99 | $119.98 |
| Buy One | 1 | $39.99 | $59.99 |

Create one option, such as **"Bundle"**, with the values *1 Bottle / 2 Bottles / 3 Bottles*, in that order. The "per bottle" text is worked out automatically.
If you'd rather keep a single variant, set each offer's *Variant position* to 0, *Quantity* to 1/2/3, and optionally add a *Discount code* with its matching *Displayed discount %*.

## Customer videos
In the theme editor, customer videos are their own section, **LW · Customer videos** (file `sections/lw-ugc.liquid`), placed directly under the product section. Each video is a **Video** block listed underneath it. Click one to edit it, drag to reorder, or use **Add block → Video** to add more.
- **Each video:** caption sticker, video file, image (if there's no video), and **Show on**: desktop and mobile, desktop only, or mobile only.
- **Section settings:** heading, **Show on desktop** and **Show on mobile**, how many videos are visible on each device, arrows and dots.
- **Position:**
  - *Inside product area*: the videos appear under the product image on desktop and after Add to Cart on phones, like Resilia.
  - *Full-width row below the product.*

## Homepage
The homepage (`templates/index.json`) uses the **LW Home** sections, with Uvola's content and a light Seed-style look. Your previous homepage is saved as the page template **old-homepage**.

## Soft style (Hers-inspired)
The homepage, and any template with **"soft"** in its name, gets a softer look: rounder panels, pastel sage and mint, and gentle shadows. **product.milk-thistle-soft** is a copy of your product page in this style, so you can compare it with the original **milk-thistle** template. To use it, pick **milk-thistle-soft** as the product's theme template.

## Fonts
The theme includes Clash Grotesk and Satoshi, the fonts Resilia uses. They're free (Fontshare ITF license) and there's nothing to buy or install. The LiverWell sections ignore your theme's global font and letter-spacing settings, so they always look the same.

## Using Kaching Bundles instead
1. In the theme editor, open the product section, click the **Buy box** block, and tick **"Use a bundle app instead of the built-in offers"**. This hides my offer cards, the gifts box, the price row and the subscribe toggle, and outputs a standard Shopify product form.
2. Click **Add block → Apps → Kaching Bundles** and drag it right above the Buy box.
3. Set up your bundles and discounts inside Kaching. Kaching's own discount sets the checkout price.
4. Test one order. If an item is added twice, turn off Kaching's own add-to-cart setting so only the buy box button adds to cart.

## 3. Subscribe & save (optional)
The toggle shows up only after you install a subscriptions app (Shopify Subscriptions, Recharge, Appstle…) and attach a selling plan to the product. It adds the first selling plan to the cart at that plan's price.

## 4. Free gifts
The **Free gift** blocks sit in the gifts box. Each offer's **"Free gifts unlocked"** setting unlocks the first N gifts (the defaults are 3 / 2 / 0).
Gifts are display-only by default. To add a real gift product, pick it in the gift block, **and** create an automatic discount that makes it free.

## 5. Before you launch (important)
- **Reviews and customer names are samples** ("Sample R.", etc.). Replace them with genuine customer reviews, or connect a reviews app (the main section accepts app blocks). Publishing invented reviews as real ones breaks FTC rules.
- **Check the formula.** The ingredients, doses and Supplement Facts panel follow your 6-ingredient formula (1 capsule daily, 30 servings). Add your "Other ingredients" line in the Supplement Facts section — it is empty until you do. Make them match your actual label.
- **Check the claims.** "Rated 4.9", "93% sold" and "FALL SALE" are placeholders you can edit. Only show numbers you can back up.
- **Upload images and videos.** Grey boxes are placeholders for the gallery, ingredient photos, UGC videos, lifestyle shots and the guarantee image.
- The FDA disclaimer (†) is at the bottom of the FAQ section. Keep it.

## Files added
- `sections/lw-*.liquid`: 18 sections (ticker, main product, stats banner, ingredients, reviews, benefits, benefit cards, timeline, reasons, comparison, guarantee, video reviews, research stats, stock-up bundle, review list, supplement facts, FAQ, sticky add to cart)
- `snippets/lw-buy-box.liquid`, `lw-icon.liquid`, `lw-stars.liquid`
- `assets/liverwell.css`, `assets/liverwell.js` (no dependencies)
- `templates/product.milk-thistle.json`
- `layout/theme.liquid`: 5 lines that load the fonts, CSS and JS
