# 🎨 Card Studio — Professional Design Tool

Card Studio is a high-performance, professional-grade design environment built specifically for Trading Card Game (TCG) creators. It combines the ease of use of Canva with the deep control of Photoshop, tailored for the unique requirements of card design.

---

## 🚀 Core Design System

Card Studio uses a **Layer-based workflow** on a high-fidelity canvas (500x700px standard).

### 🛠 The Toolset
*   **Select (V)**: Manipulation of objects (Transform, rotate, scale).
*   **Text (T)**: Contextual text editing with support for 26+ curated Google Fonts and custom font imports.
*   **Drawing (B)**: Freehand pencil tool with adjustable size and opacity.
*   **Eraser (E)**: Precise element erasing using standard or destination-out masking.
*   **Shapes (R/O)**: A massive catalog of 20+ shapes including Rectangles, Circles, Stars, Hearts, Clouds, and Polygons.
*   **Eyedropper (K)**: Rapid color sampling from any point on the canvas.
*   **Fill (F)**: Instant fill application of recent colors to shapes.
*   **Crop (C)**: Non-destructive image cropping via draggable bounding boxes.
*   **Hand (H/Space)**: Smooth canvas panning and navigation.

### 📑 Layer Management
*   **Reorder & Stack**: Drag-and-drop layer reordering with real-time thumbnail previews.
*   **Visibility & Locking**: Toggle visibility or lock layers to prevent accidental movement.
*   **Inline Renaming**: Double-click any layer name to rename it instantly.
*   **Group / Ungroup (Ctrl+G)**: Bundle multiple elements into a single manageable unit.

---

## 🃏 TCG specialized Features

### 🧩 Trait Zones & Mechanics
The most powerful feature for TCG design. Define a **Trait Zone** where card mechanics (Traits, Descriptions, and Icons) are automatically rendered and previewed.
*   **Genesis Support**: Automatic rendering of "Genesis" style traits with side-by-side icons.
*   **Trait Templates**: Save and load specific zone layouts (font sizes, colors, alignments) as reusable templates.
*   **Live Preview**: Real-time rendering of trait text and icons directly from the mechanic database.

### 👻 Design Aids
*   **Template Ghosting (Ctrl+Shift+G)**: Overlay your card template at 35% opacity to align elements perfectly with the final card frame.
*   **Trait Overlay**: Visually toggle the safe-zone where traits will be "baked" onto the final card.

---

## ⚡ Advanced Workflow & UX

*   **Smart Guides**: Intelligent object-to-object snapping lines for pixel-perfect alignment.
*   **Snap to Grid (G)**: 10px grid snapping for structured layouts.
*   **Undo / Redo (Ctrl+Z/Y)**: 60-step persistent history stack.
*   **Session Recovery**: Auto-saves a draft every 60s to `localStorage`. If the browser crashes, you can restore your work with one click.
*   **Server Side Drafts**: Automatically syncs your progress to the server as a draft every 30s.
*   **Clipboard (Ctrl+C/V/X)**: Full Copy/Cut/Paste support across layers.
*   **Arrow Nudge**: Fine-tune position with Arrow keys (1px) or Shift+Arrow (10px).

---

## 🖼 Technical Capabilities

### High-End Visuals
*   **Gradients**: Apply Linear or Radial gradients to any shape with custom color stops.
*   **Image Adjustments**: Non-destructive filters for **Brightness, Contrast, and Saturation**.
*   **Background Removal**: AI-powered "Remove Background" feature for uploaded image layers.
*   **Blend Modes**: 16 CSS blend modes (Multiply, Screen, Overlay, etc.) for advanced lighting and foil effects.

### Production-Ready Export
*   **Resolution Scaling**: The editor runs at 500x700px for speed, but exports at **750x1050px (multiplier: 1.5)** for production quality.
*   **Local Download**: Export your design as high-quality **PNG (with transparency)** or **JPG**.
*   **Foil Masking**: Automatically generates a greyscale alpha-mask for all layers marked as "Shiny", used for holographic rendering on the platform.

---

## ⌨️ Common Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| **V** | Select Tool |
| **T** | Text Tool |
| **B** | Brush Tool |
| **E** | Eraser Tool |
| **R** | Add Rectangle |
| **O** | Add Circle |
| **L** | Add Line |
| **I** | Add Image |
| **C** | Crop Tool |
| **H / Space** | Hand Tool (Pan) |
| **Ctrl + Z / Y** | Undo / Redo |
| **Ctrl + C / V / X**| Copy / Paste / Cut |
| **Ctrl + D** | Duplicate |
| **Ctrl + A** | Select All |
| **Ctrl + G** | Group |
| **Ctrl + S** | Save Card |
| **G** | Toggle Grid |
| **0** | Fit to Screen |
| **?** | Show all shortcuts |

---

## 🧠 How It Works (Technical Underpinnings)

1.  **Fabric.js Engine**: Card Studio is powered by an optimized implementation of Fabric.js v5.3.0.
2.  **Layer Data (JSON)**: Designs are persisted as a custom JSON blob containing all layer coordinates, types, and metadata (e.g., `shiny` flag, `originalUrl`).
3.  **Image Proxying**: All external images are automatically routed through an internal proxy (`/api/img-proxy`) to bypass CORS restrictions and allow canvas export.
4.  **Coordinate Neutrality**: The studio translates editor coordinates to "baked" card coordinates using a 1.5x multiplier during the save process, ensuring traits and artwork align perfectly on the platform.
