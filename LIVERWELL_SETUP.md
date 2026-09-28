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
- **Check the formula.** The ingredients, doses and Supplement Facts panel follow a typical 8-ingredient milk thistle formula. Make them match your actual label.
- **Check the claims.** "Rated 4.9", "93% sold" and "FALL SALE" are placeholders you can edit. Only show numbers you can back up.
- **Upload images and videos.** Grey boxes are placeholders for the gallery, ingredient photos, UGC videos, lifestyle shots and the guarantee image.
- The FDA disclaimer (†) is at the bottom of the FAQ section. Keep it.

## Files added
- `sections/lw-*.liquid`: 18 sections (ticker, main product, stats banner, ingredients, reviews, benefits, benefit cards, timeline, reasons, comparison, guarantee, video reviews, research stats, stock-up bundle, review list, supplement facts, FAQ, sticky add to cart)
- `snippets/lw-buy-box.liquid`, `lw-icon.liquid`, `lw-stars.liquid`
- `assets/liverwell.css`, `assets/liverwell.js` (no dependencies)
- `templates/product.milk-thistle.json`
- `layout/theme.liquid`: 5 lines that load the fonts, CSS and JS
