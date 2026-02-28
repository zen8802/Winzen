# Avatar Items

## How to add a new item

1. **Design** at exactly **400×700px** in Figma (or any tool)
   - Transparent background
   - Only draw the item — the body registers automatically
   - Match the base character proportions

2. **Export** as PNG → place here:
   ```
   /public/avatar/items/[category]/[slug].png
   ```
   Example: `/public/avatar/items/hat/hat_fitted_black.png`

3. **Add a DB row** in `prisma/seed.ts` or via admin panel:
   ```ts
   { category: "hat", name: "Fitted Black", price: 200, icon: "/avatar/items/hat/hat_fitted_black.png" }
   ```

4. **Run** `npm run db:push` if schema changed, or just restart dev server.

That's it. No code changes needed.

## Categories & layer order

| Category | Layer order | Notes |
|----------|-------------|-------|
| `eyes`   | 2nd (above base) | Face items: glasses, eye style, facial hair |
| `top`    | 3rd | Shirts, hoodies, jackets |
| `bottom` | 4th | Pants, shorts, skirts |
| `shoes`  | 5th | Sneakers, boots, etc. |
| `hat`    | 6th (top) | Caps, beanies, etc. |

## Canvas reference points (400×700)

```
Head center: (200, 140)
Torso center: (200, 310)
Waist: y ≈ 410
Knees: y ≈ 490
Feet: y ≈ 575
```
