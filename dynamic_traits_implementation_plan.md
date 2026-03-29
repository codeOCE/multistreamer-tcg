# Implementation Plan - Dynamic Card Trait Rendering

Enable creators to upload blank card templates and define dynamic text areas where card traits (mechanics) will be rendered automatically.

## Proposed Changes

### Database Schema
[NEW] `card_templates` table:
- `id` (UUID, primary key)
- `streamer_id` (UUID, references streamers)
- `name` (TEXT)
- `blank_image_url` (TEXT) - URL to the template in R2
- `trait_x` (INT), `trait_y` (INT), `trait_width` (INT), `trait_height` (INT)
- `font_family` (TEXT), `font_size` (INT), `font_color` (TEXT)
- `text_alignment` (TEXT: 'left', 'center', 'right')
- `created_at` (TIMESTAMPTZ)

[MODIFY] `cards` table:
- Add `template_id` (UUID, references card_templates, nullable)
- Add `trait_list` (JSONB) - Override traits for this specific card instance if needed, or default to inherited mechanics.

---

### Creator Flow (Frontend)
[NEW] `public/views/card-template-editor.html`:
- Image upload (Drag & Drop).
- Canvas-based "Area Selector" tool to define the `trait_x/y/width/height`.
- Real-time preview: Render dummy traits on the card as the user changes font settings.
- Integration: Add "Use Template" dropdown in the existing Card Creator UI.

---

### Dynamic Rendering Engine (Backend)
[MODIFY] `src/index.ts`:
- New Route: `GET /api/cards/:card_id/image.png`
- **Logic**:
    1. Fetch card data and its linked template settings.
    2. Generate an SVG template string:
       ```xml
       <svg width="card_width" height="card_height">
         <image href="blank_image_url" />
         <foreignObject x="trait_x" y="trait_y" width="trait_width" height="trait_height">
           <div style="font-family: ...; font-size: ...; color: ...;">
             Trait 1, Trait 2...
           </div>
         </foreignObject>
       </svg>
       ```
    3. Use `resvg-wasm` (if PNG is strictly required) or return SVG with `Content-Type: image/svg+xml`.
    4. **Caching**: Store the result in R2 under `rendered/{card_id}_{hash_of_traits}.png`. Use Cloudflare Cache API for edge delivery.

---

### Viewer Pull Flow (Integration)
[MODIFY] `src/index.ts` (or relevant reward handler):
1. **Trigger**: Viewer redeems channel points or opens a pack.
2. **Trait Assignment**: Roll N traits based on rarity from the `mechanics` table.
3. **Card Instance**: Store the assigned trait IDs in the `user_cards` table (as already exists, but linking to the new dynamic template).
4. **Initial Rendering**: Pre-calculate the dynamic image URL (pointing to the rendering API) to display immediately in the "Pack Opening" animation.

---

### Scaling & Performance
- **Hybrid Approach**: 
    - Dynamic rendering for the first request.
    - Persistent storage in R2 for subsequent requests.
    - Cache-Control headers for browser/CDN caching.
- **Optimization**: Use `Intl.Segmenter` or simple logic for text wrapping if not using `<foreignObject>`.

## Verification Plan

### Automated Tests
- `vitest` unit tests for the SVG generation logic:
    - Verify correct coordinate mapping.
    - Verify text wrapping logic for long trait lists.
- API Integration Test: `GET /api/cards/:id/image.png` returns 200 and correct content-type.

### Manual Verification
1. **Creator Setup**:
   - Upload a template.
   - Select a trait area.
   - Save.
2. **Card Creation**:
   - Create a card using the new template.
   - Assign 3+ traits.
3. **Viewer View**:
   - Open a viewer dashboard or binder.
   - Verify the card renders with traits correctly overlayed in the designated area.
4. **Style Changes**:
   - Change font color in the template.
   - Verify the card image updates (cache busting).
